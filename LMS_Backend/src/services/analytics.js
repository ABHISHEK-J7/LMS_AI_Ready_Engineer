import { AttendanceStatus, ModuleProgressStatus, SubmissionStatus, UserRole, UserStatus } from '@lms/shared';
import {
  Assessment,
  Attendance,
  Batch,
  Certificate,
  ClassSchedule,
  Module,
  ModuleProgress,
  Submission,
  User,
  getSettings,
} from '../models/index.js';

const ATTENDED = [AttendanceStatus.PRESENT, AttendanceStatus.LATE];

/** present/(total-excused) % from a grouped attendance row. */
function pctFrom({ attended, excused, total }) {
  const denom = total - excused;
  return denom > 0 ? Math.round((attended / denom) * 100) : 0;
}

/** $group expr building blocks for attendance percentage. */
const ATT_GROUP = {
  attended: { $sum: { $cond: [{ $in: ['$status', ATTENDED] }, 1, 0] } },
  excused: { $sum: { $cond: [{ $eq: ['$status', AttendanceStatus.EXCUSED] }, 1, 0] } },
  total: { $sum: 1 },
};

// ── Admin ──────────────────────────────────────────────────────────────────────

export async function adminOverview() {
  const settings = await getSettings();
  const threshold = settings.minAttendance;

  const [students, trainers, batches, modules, certificates] = await Promise.all([
    User.countDocuments({ role: UserRole.STUDENT, status: UserStatus.ACTIVE }),
    User.countDocuments({ role: UserRole.TRAINER, status: UserStatus.ACTIVE }),
    Batch.countDocuments({ archived: false }),
    Module.countDocuments({ archived: false }),
    Certificate.countDocuments(),
  ]);

  // Attendance % per student (one aggregation), then flag those below the minimum.
  const attRows = await Attendance.aggregate([
    { $group: { _id: '$student', ...ATT_GROUP } },
  ]);
  const studentDocs = await User.find({ _id: { $in: attRows.map((r) => r._id) } })
    .select('name email batch')
    .populate('batch', 'name');
  const nameById = new Map(studentDocs.map((s) => [s._id.toString(), s]));

  const lowAttendance = attRows
    .map((r) => ({
      id: r._id.toString(),
      percentage: pctFrom(r),
      totalClasses: r.total,
      info: nameById.get(r._id.toString()),
    }))
    .filter((r) => r.info && r.totalClasses > 0 && r.percentage < threshold)
    .map((r) => ({
      student: r.info.name,
      batch: r.info.batch?.name ?? '—',
      percentage: r.percentage,
    }))
    .sort((a, b) => a.percentage - b.percentage);

  // Students per active batch.
  const batchDocs = await Batch.find({ archived: false }).select('name students');
  const batchSizes = batchDocs
    .map((b) => ({ batch: b.name, students: b.students.length }))
    .sort((a, b) => b.students - a.students)
    .slice(0, 12);

  // Module completion distribution from ModuleProgress snapshots.
  const progRows = await ModuleProgress.aggregate([
    { $group: { _id: { module: '$module', status: '$status' }, n: { $sum: 1 } } },
  ]);
  const moduleDocs = await Module.find({ archived: false }).select('name order').sort({ order: 1 });
  const byModule = new Map();
  for (const m of moduleDocs) byModule.set(m._id.toString(), { module: m.name, order: m.order, completed: 0, inProgress: 0 });
  for (const row of progRows) {
    const entry = byModule.get(row._id.module?.toString());
    if (!entry) continue;
    if (row._id.status === ModuleProgressStatus.COMPLETED) entry.completed += row.n;
    else if (row._id.status === ModuleProgressStatus.IN_PROGRESS) entry.inProgress += row.n;
  }
  const moduleCompletion = [...byModule.values()].sort((a, b) => a.order - b.order);

  return {
    counts: { students, trainers, batches, modules, certificates },
    lowAttendance: { threshold, count: lowAttendance.length, students: lowAttendance.slice(0, 10) },
    batchSizes,
    moduleCompletion,
  };
}

// ── Trainer ──────────────────────────────────────────────────────────────────

export async function trainerOverview(trainerId) {
  const trainer = await User.findById(trainerId).select('assignedModules assignedBatches');
  const moduleIds = trainer?.assignedModules ?? [];
  const batchIds = trainer?.assignedBatches ?? [];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const batchDocs = await Batch.find({ _id: { $in: batchIds } }).select('name students');
  const studentSet = new Set();
  batchDocs.forEach((b) => b.students.forEach((s) => studentSet.add(s.toString())));

  const upcomingClasses = await ClassSchedule.countDocuments({
    trainer: trainerId,
    date: { $gte: todayStart },
  });

  // Per-batch average attendance.
  const batchAttRows = await Attendance.aggregate([
    { $match: { batch: { $in: batchIds } } },
    { $group: { _id: '$batch', ...ATT_GROUP } },
  ]);
  const attByBatch = new Map(batchAttRows.map((r) => [r._id.toString(), pctFrom(r)]));
  const batches = batchDocs.map((b) => ({
    batch: b.name,
    students: b.students.length,
    avgAttendance: attByBatch.get(b._id.toString()) ?? 0,
  }));

  // Per-assessment analytics for the trainer's modules.
  const assessmentDocs = await Assessment.find({ module: { $in: moduleIds } })
    .select('title type practiceIndex module')
    .populate('module', 'name code');
  const subRows = await Submission.aggregate([
    { $match: { assessment: { $in: assessmentDocs.map((a) => a._id) }, status: SubmissionStatus.GRADED } },
    {
      $group: {
        _id: '$assessment',
        submissions: { $sum: 1 },
        passed: { $sum: { $cond: ['$passed', 1, 0] } },
        avgScore: { $avg: '$score' },
      },
    },
  ]);
  const statsById = new Map(subRows.map((r) => [r._id.toString(), r]));
  const assessments = assessmentDocs.map((a) => {
    const s = statsById.get(a._id.toString());
    const submissions = s?.submissions ?? 0;
    return {
      title: a.title,
      module: a.module?.name ?? '—',
      type: a.type,
      submissions,
      passRate: submissions ? Math.round((s.passed / submissions) * 100) : 0,
      avgScore: s?.avgScore != null ? Math.round(s.avgScore) : 0,
    };
  });

  return {
    counts: {
      modules: moduleIds.length,
      batches: batchIds.length,
      students: studentSet.size,
      upcomingClasses,
    },
    batches,
    assessments,
  };
}
