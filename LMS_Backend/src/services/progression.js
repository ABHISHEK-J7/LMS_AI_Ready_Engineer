import {
  AssessmentType,
  ModuleProgressStatus,
  SubmissionStatus,
} from '@lms/shared';
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
 * A module is COMPLETE when the student passed its final assessment AND met the
 * attendance minimum for that module. The next module unlocks only once the
 * previous one is complete (Beginner → Expert). Practice tests remain
 * trainer-unlocked (handled in the assessment flow) and are surfaced as counts.
 *
 * Side effect: upserts a ModuleProgress doc per module so admins/analytics can
 * query the latest standing without recomputing.
 *
 * @returns {Promise<{ hasBatch: boolean, minAttendance: number, passingScore: number,
 *   modules: object[], completedCount: number, total: number, eligibleForCertificate: boolean }>}
 */
export async function computeProgress(studentId) {
  const settings = await getSettings();
  const minAttendance = settings.minAttendance;
  const passingScore = settings.passingScore;

  const student = await User.findById(studentId).select('batch');
  if (!student?.batch) {
    return { hasBatch: false, minAttendance, passingScore, modules: [], completedCount: 0, total: 0, eligibleForCertificate: false };
  }

  const batch = await Batch.findById(student.batch).populate({
    path: 'modules',
    select: 'name code order level',
    options: { sort: { order: 1 } },
  });
  const modules = (batch?.modules ?? []).slice().sort((a, b) => a.order - b.order);

  const computed = [];
  for (const module of modules) {
    // Attendance for this module.
    const records = await Attendance.find({ student: studentId, module: module._id });
    const summary = computeSummary(records);
    const attendanceMet = summary.totalClasses > 0 ? summary.percentage >= minAttendance : true;

    // Final assessment result.
    const finalAssessment = await Assessment.findOne({ module: module._id, type: AssessmentType.FINAL }).select('_id');
    let finalScore;
    let finalPassed = false;
    if (finalAssessment) {
      const sub = await Submission.findOne({ assessment: finalAssessment._id, student: studentId });
      if (sub && sub.status === SubmissionStatus.GRADED) {
        finalScore = sub.score;
        finalPassed = sub.passed === true;
      }
    }

    // Passed practice tests for this module.
    const practiceAssessments = await Assessment.find({
      module: module._id,
      type: AssessmentType.PRACTICE,
    }).select('_id');
    let practiceTestsCompleted = 0;
    if (practiceAssessments.length) {
      practiceTestsCompleted = await Submission.countDocuments({
        assessment: { $in: practiceAssessments.map((a) => a._id) },
        student: studentId,
        status: SubmissionStatus.GRADED,
        passed: true,
      });
    }

    const completed = finalPassed && attendanceMet;
    computed.push({
      module: {
        id: module._id.toString(),
        name: module.name,
        code: module.code,
        order: module.order,
        level: module.level,
      },
      attendancePercentage: summary.percentage,
      attendanceMet,
      hasFinal: Boolean(finalAssessment),
      finalScore,
      finalPassed,
      practiceTestsCompleted,
      completed,
    });
  }

  // Sequential unlock: module[i] is unlocked iff module[i-1] is completed.
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

  // Persist a ModuleProgress snapshot per module.
  await Promise.all(
    computed.map((e) =>
      ModuleProgress.findOneAndUpdate(
        { student: studentId, module: e.module.id },
        {
          $set: {
            status: e.status,
            attendancePercentage: e.attendancePercentage,
            practiceTestsCompleted: e.practiceTestsCompleted,
            finalScore: e.finalScore,
            completedAt: e.completed ? new Date() : undefined,
          },
        },
        { upsert: true, setDefaultsOnInsert: true },
      ),
    ),
  );

  const completedCount = computed.filter((e) => e.completed).length;
  return {
    hasBatch: true,
    minAttendance,
    passingScore,
    modules: computed,
    completedCount,
    total: computed.length,
    eligibleForCertificate: computed.length > 0 && completedCount === computed.length,
  };
}
