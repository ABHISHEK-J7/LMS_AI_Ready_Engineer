import { z } from 'zod';
import { QuestionType, SubmissionStatus, UserRole } from '@lms/shared';
import { Assessment, Batch, Module, Submission, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';
import { isAvailableNow } from './assessment.controller.js';
import {
  gradeInBackground,
  gradeSubmission,
  getEvaluator,
  needsAiGrading,
} from '../services/aiGrading.js';

const objectId = z.string().length(24);
export const assessmentIdParam = z.object({ id: objectId });
export const submissionParam = z.object({ id: objectId, submissionId: objectId });

export const submitSchema = z.object({
  answers: z
    .array(
      z.object({
        question: objectId,
        selectedOption: z.number().int().min(0).optional(),
        text: z.string().optional(),
      }),
    )
    .min(1),
});

async function ensureStudentCanAccess(req, assessment) {
  const me = await User.findById(req.auth.userId).select('batch');
  if (!me?.batch) throw ApiError.forbidden('You are not enrolled in a batch');
  const inCurriculum = await Module.exists({ _id: assessment.module }); // module exists
  if (!inCurriculum) throw ApiError.badRequest('Module no longer exists');
}

export async function submit(req, res) {
  const assessment = await Assessment.findById(req.params.id);
  if (!assessment) throw ApiError.notFound('Assessment not found');
  await ensureStudentCanAccess(req, assessment);

  if (!isAvailableNow(assessment)) {
    throw ApiError.forbidden('This assessment is locked or outside its availability window');
  }

  // Single attempt: reject if already submitted/graded.
  const existing = await Submission.findOne({ assessment: assessment._id, student: req.auth.userId });
  if (existing && existing.status !== SubmissionStatus.NOT_STARTED) {
    throw ApiError.conflict('You have already submitted this assessment');
  }

  // Validate every answer references a real question in this assessment.
  const questionIds = new Set(assessment.questions.map((q) => q._id.toString()));
  for (const a of req.body.answers) {
    if (!questionIds.has(a.question)) throw ApiError.badRequest('Answer references an unknown question');
  }

  // Persist the answers first, as a SUBMITTED record.
  const submission = await Submission.findOneAndUpdate(
    { assessment: assessment._id, student: req.auth.userId },
    {
      $set: {
        answers: req.body.answers,
        status: SubmissionStatus.SUBMITTED,
        submittedAt: new Date(),
      },
      $unset: { score: '', passed: '', feedback: '' },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  if (needsAiGrading(assessment)) {
    if (await getEvaluator()) {
      // Hand off to the AI engine asynchronously; the student polls for the result.
      submission.status = SubmissionStatus.EVALUATING;
      await submission.save();
      ok(res, { id: submission.id, status: submission.status, passingScore: assessment.passingScore });
      gradeInBackground(assessment._id, submission._id); // fire-and-forget
      return;
    }
    // No evaluator configured — leave for manual review.
    ok(res, {
      id: submission.id,
      status: submission.status,
      passingScore: assessment.passingScore,
      autoGraded: false,
    });
    return;
  }

  // All-MCQ → grade synchronously (no evaluator needed).
  await gradeSubmission(assessment, submission);
  // A passed final may complete a module → issue earned certificates (idempotent).
  const { issueEligibleCertificates } = await import('../services/certificates.js');
  issueEligibleCertificates(req.auth.userId).catch(() => {});
  ok(res, {
    id: submission.id,
    status: submission.status,
    score: submission.score,
    passed: submission.passed,
    passingScore: assessment.passingScore,
    autoGraded: true,
  });
}

/** Admin/assigned-trainer: (re)trigger AI grading for a submission. */
export async function regradeSubmission(req, res) {
  const assessment = await Assessment.findById(req.params.id);
  if (!assessment) throw ApiError.notFound('Assessment not found');
  if (req.auth.role === UserRole.TRAINER) {
    const module = await Module.findById(assessment.module).select('assignedTrainers');
    const assigned = module?.assignedTrainers.some((t) => t.toString() === req.auth.userId);
    if (!assigned) throw ApiError.forbidden('You are not assigned to this module');
  }
  const submission = await Submission.findOne({
    _id: req.params.submissionId,
    assessment: assessment._id,
  });
  if (!submission) throw ApiError.notFound('Submission not found');
  if (!(await getEvaluator())) throw ApiError.badRequest('AI evaluation engine is not configured');

  await gradeSubmission(assessment, submission);
  ok(res, submission.toJSON());
}

/** The signed-in student's submission for an assessment (or null). */
export async function getMySubmission(req, res) {
  const sub = await Submission.findOne({ assessment: req.params.id, student: req.auth.userId });
  ok(res, sub ? sub.toJSON() : null);
}

/** All submissions for an assessment (admin or assigned trainer). */
export async function listSubmissions(req, res) {
  const assessment = await Assessment.findById(req.params.id);
  if (!assessment) throw ApiError.notFound('Assessment not found');
  if (req.auth.role === UserRole.TRAINER) {
    const module = await Module.findById(assessment.module).select('assignedTrainers');
    const assigned = module?.assignedTrainers.some((t) => t.toString() === req.auth.userId);
    if (!assigned) throw ApiError.forbidden('You are not assigned to this module');
  }
  const subs = await Submission.find({ assessment: assessment._id })
    .sort({ submittedAt: -1 })
    .populate('student', 'name email');
  ok(res, subs.map((s) => s.toJSON()));
}

/**
 * Ranked leaderboard for an assessment, scoped to the requesting student's batch
 * (highest score first, earliest submission breaks ties). Trainers/admins may
 * pass ?batch=<id> to scope; without it they see everyone who took it.
 */
export async function leaderboard(req, res) {
  const { id } = req.params;
  const { role, userId } = req.auth;

  let studentIds = null; // null = no batch scoping (all participants)
  if (role === UserRole.STUDENT) {
    const me = await User.findById(userId).select('batch');
    if (!me?.batch) throw ApiError.forbidden('You are not enrolled in a batch');
    const batch = await Batch.findById(me.batch).select('students');
    studentIds = (batch?.students ?? []).map((s) => s.toString());
  } else if (req.query.batch) {
    const batch = await Batch.findById(req.query.batch).select('students');
    studentIds = (batch?.students ?? []).map((s) => s.toString());
  }

  const filter = { assessment: id, status: SubmissionStatus.GRADED };
  if (studentIds) filter.student = { $in: studentIds };

  const subs = await Submission.find(filter)
    .sort({ score: -1, submittedAt: 1 })
    .populate('student', 'name');

  const entries = subs.map((s, i) => ({
    rank: i + 1,
    name: s.student?.name ?? 'Student',
    score: s.score ?? 0,
    passed: s.passed === true,
    isMe: Boolean(s.student && s.student._id.toString() === userId),
  }));

  ok(res, { participants: entries.length, entries });
}
