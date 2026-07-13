import {
  AssessmentType,
  ModuleProgressStatus,
  SubmissionStatus,
} from '#shared';
import {
  Assessment,
  Attendance,
  Batch,
  ModuleProgress,
  Submission,
  User,
  getSettings,
} from '../models/index.js';
import { computeSummary } from '../controllers/attendance.controller.js';

/**
 * Compute a student's progression across their batch's ordered curriculum.
 *
 * ADVANCEMENT is gated on the TRAINER finishing the syllabus, not on the student
 * passing the final. A module "advances" (unlocks the next one) once the trainer
 * has marked all of its topics taught for this batch — regardless of whether the
 * student passed, failed, or skipped the final. (Passing the final also advances,
 * as a fallback for modules with no syllabus defined.) The final test is optional.
 *
 * MASTERY (`passed` = passed final + met attendance) is tracked separately and is
 * what earns the module/program certificate — a student who fails advances to the
 * next module but does NOT get that module's certificate.
 *
 * Side effect: upserts a ModuleProgress doc per module so admins/analytics can
 * query the latest standing without recomputing.
 *
 * @returns {Promise<{ hasBatch: boolean, minAttendance: number, passingScore: number,
 *   modules: object[], completedCount: number, passedCount: number, total: number,
 *   eligibleForCertificate: boolean }>}
 */
export async function computeProgress(studentId) {
  const settings = await getSettings();
  const minAttendance = settings.minAttendance;
  const passingScore = settings.passingScore;

  const student = await User.findById(studentId).select('batch organization');
  if (!student?.batch) {
    return { hasBatch: false, minAttendance, passingScore, modules: [], completedCount: 0, total: 0, eligibleForCertificate: false };
  }

  const batch = await Batch.findById(student.batch).populate({
    path: 'modules',
    select: 'name code order level topics',
    options: { sort: { order: 1 } },
  });
  const modules = (batch?.modules ?? []).slice().sort((a, b) => a.order - b.order);

  // Per-module set of topic ids the trainer has marked taught for THIS batch.
  const taughtByModule = new Map(
    (batch?.taughtTopics ?? []).map((tt) => [tt.module.toString(), new Set((tt.topics ?? []).map((t) => t.toString()))]),
  );

  // ── Batch every input in a handful of queries (was ~5 queries PER module) ──
  const moduleIds = modules.map((m) => m._id);
  const [allAttendance, allAssessments] = await Promise.all([
    Attendance.find({ student: studentId, module: { $in: moduleIds } }).select('module status'),
    Assessment.find({ module: { $in: moduleIds }, type: { $in: [AssessmentType.FINAL, AssessmentType.PRACTICE] } }).select('module type'),
  ]);
  const subs = await Submission.find({
    student: studentId,
    assessment: { $in: allAssessments.map((a) => a._id) },
  }).select('assessment status score passed');
  const subByAssessment = new Map(subs.map((s) => [s.assessment.toString(), s]));

  const push = (map, k, v) => { const arr = map.get(k); if (arr) arr.push(v); else map.set(k, [v]); };
  const attByModule = new Map();
  for (const r of allAttendance) push(attByModule, r.module.toString(), r);
  const finalByModule = new Map();
  const practiceByModule = new Map();
  for (const a of allAssessments) {
    const k = a.module.toString();
    if (a.type === AssessmentType.FINAL) finalByModule.set(k, a._id);
    else push(practiceByModule, k, a._id);
  }

  const computed = modules.map((module) => {
    const mid = module._id.toString();
    const summary = computeSummary(attByModule.get(mid) ?? []);
    const attendanceMet = summary.totalClasses > 0 ? summary.percentage >= minAttendance : true;

    const finalId = finalByModule.get(mid);
    let finalScore;
    let finalPassed = false;
    if (finalId) {
      const sub = subByAssessment.get(finalId.toString());
      if (sub && sub.status === SubmissionStatus.GRADED) {
        finalScore = sub.score;
        finalPassed = sub.passed === true;
      }
    }

    const practiceTestsCompleted = (practiceByModule.get(mid) ?? []).reduce((n, id) => {
      const sub = subByAssessment.get(id.toString());
      return n + (sub && sub.status === SubmissionStatus.GRADED && sub.passed === true ? 1 : 0);
    }, 0);

    // Syllabus complete = trainer marked every topic of this module taught for this
    // batch. (A module with no topics defined never auto-completes this way.)
    const topicIds = (module.topics ?? []).map((t) => t._id.toString());
    const taughtSet = taughtByModule.get(mid) ?? new Set();
    const syllabusComplete = topicIds.length > 0 && topicIds.every((id) => taughtSet.has(id));

    // Mastery (earns the certificate) vs. advancement (unlocks the next module).
    const passed = finalPassed && attendanceMet;
    const completed = syllabusComplete || finalPassed; // "advanced"
    return {
      module: { id: mid, name: module.name, code: module.code, order: module.order, level: module.level },
      attendancePercentage: summary.percentage,
      attendanceMet,
      hasFinal: Boolean(finalId),
      finalScore,
      finalPassed,
      passed,
      syllabusComplete,
      practiceTestsCompleted,
      completed,
    };
  });

  // Sequential unlock: module[i] is unlocked iff module[i-1] has advanced
  // (trainer finished its syllabus, or the student passed its final).
  let prevCompleted = true;
  for (const entry of computed) {
    const unlocked = prevCompleted;
    entry.status = entry.completed
      ? ModuleProgressStatus.COMPLETED
      : unlocked
        ? ModuleProgressStatus.IN_PROGRESS
        : ModuleProgressStatus.LOCKED;
    entry.locked = entry.status === ModuleProgressStatus.LOCKED;
    prevCompleted = entry.completed;
  }

  // Persist the ModuleProgress snapshot in ONE bulk write (was N upserts).
  if (computed.length) {
    await ModuleProgress.bulkWrite(
      computed.map((e) => ({
        updateOne: {
          filter: { student: studentId, module: e.module.id },
          update: {
            $set: {
              status: e.status,
              attendancePercentage: e.attendancePercentage,
              practiceTestsCompleted: e.practiceTestsCompleted,
              finalScore: e.finalScore,
              completedAt: e.completed ? new Date() : undefined,
              // bulkWrite bypasses the tenant plugin — stamp the org explicitly so
              // these snapshots aren't org-less (and thus invisible to scoped reads).
              organization: student.organization ?? null,
            },
          },
          upsert: true,
        },
      })),
    );
  }

  const completedCount = computed.filter((e) => e.completed).length;
  const passedCount = computed.filter((e) => e.passed).length;
  return {
    hasBatch: true,
    minAttendance,
    passingScore,
    modules: computed,
    completedCount,
    passedCount,
    total: computed.length,
    // The program certificate requires MASTERY of every module (passing each
    // final + attendance), not merely advancing through the syllabus.
    eligibleForCertificate: computed.length > 0 && passedCount === computed.length,
  };
}
