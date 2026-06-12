import { z } from 'zod';
import { AssessmentAvailability, AssessmentType, QuestionType, UserRole } from '@lms/shared';
import {
  Assessment,
  Batch,
  Module,
  Submission,
  User,
  getSettings,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';

const objectId = z.string().length(24);

export const assessmentIdParam = z.object({ id: objectId });
export const questionParam = z.object({ id: objectId, questionId: objectId });

export const listAssessmentsQuery = z.object({
  module: objectId.optional(),
  type: z.nativeEnum(AssessmentType).optional(),
});

const questionInput = z
  .object({
    type: z.nativeEnum(QuestionType),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).optional(),
    correctOption: z.number().int().min(0).optional(),
    points: z.number().int().min(1).max(100).default(1),
  })
  .superRefine((q, ctx) => {
    if (q.type === QuestionType.MCQ) {
      if (!q.options || q.options.length < 2) {
        ctx.addIssue({ code: 'custom', message: 'MCQ needs at least 2 options', path: ['options'] });
      } else if (q.correctOption === undefined || q.correctOption >= q.options.length) {
        ctx.addIssue({ code: 'custom', message: 'correctOption out of range', path: ['correctOption'] });
      }
    }
  });

export const createAssessmentSchema = z
  .object({
    title: z.string().min(2),
    module: objectId,
    type: z.nativeEnum(AssessmentType),
    practiceIndex: z.number().int().min(1).max(5).optional(),
    passingScore: z.number().int().min(0).max(100).optional(),
    availableFrom: z.coerce.date().optional(),
    deadline: z.coerce.date().optional(),
    questions: z.array(questionInput).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.type === AssessmentType.PRACTICE && d.practiceIndex === undefined) {
      ctx.addIssue({ code: 'custom', message: 'practiceIndex (1–5) is required for practice tests', path: ['practiceIndex'] });
    }
  });

export const updateAssessmentSchema = z.object({
  title: z.string().min(2).optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
  availableFrom: z.coerce.date().optional().nullable(),
  deadline: z.coerce.date().optional().nullable(),
});

export const unlockSchema = z.object({
  availableFrom: z.coerce.date().optional(),
  deadline: z.coerce.date().optional(),
});

export const questionParamBody = questionInput;
export const bulkQuestionsSchema = z.object({
  questions: z.array(questionInput).min(1, 'No questions to import').max(500),
});

// ── Authorization / visibility helpers ────────────────────────────────────────

/** Admin, or a trainer assigned to the assessment's module. Returns the assessment doc. */
async function loadAssessmentForManage(req) {
  const assessment = await Assessment.findById(req.params.id);
  if (!assessment) throw ApiError.notFound('Assessment not found');
  if (req.auth.role === UserRole.TRAINER) {
    const module = await Module.findById(assessment.module).select('assignedTrainers');
    const assigned = module?.assignedTrainers.some((t) => t.toString() === req.auth.userId);
    if (!assigned) throw ApiError.forbidden('You are not assigned to this module');
  }
  return assessment;
}

function isAvailableNow(a, now = new Date()) {
  if (a.availability !== AssessmentAvailability.UNLOCKED) return false;
  if (a.availableFrom && now < a.availableFrom) return false;
  if (a.deadline && now > a.deadline) return false;
  return true;
}

/** Student-facing projection: never leak the correct answer. */
function toStudentView(a) {
  const json = a.toJSON();
  json.questions = json.questions.map((q) => {
    const { correctOption, ...rest } = q;
    return rest;
  });
  return json;
}

/** Module ids in the signed-in student's batch (empty if no batch). */
async function studentModuleIds(userId) {
  const me = await User.findById(userId).select('batch');
  if (!me?.batch) return [];
  const batch = await Batch.findById(me.batch).select('modules');
  return batch?.modules ?? [];
}

// ── Listing / reading ─────────────────────────────────────────────────────────

export async function listAssessments(req, res) {
  const { role, userId } = req.auth;
  const filter = {};
  if (req.query.type) filter.type = req.query.type;

  if (role === UserRole.STUDENT) {
    const moduleIds = await studentModuleIds(userId);
    filter.module = { $in: moduleIds };
    filter.availability = AssessmentAvailability.UNLOCKED; // students only see unlocked
  } else if (req.query.module) {
    filter.module = req.query.module;
  }

  const assessments = await Assessment.find(filter)
    .sort({ module: 1, type: 1, practiceIndex: 1 })
    .populate('module', 'name code');

  if (role === UserRole.STUDENT) {
    // Attach the student's submission summary + a computed "available now" flag.
    const subs = await Submission.find({
      student: userId,
      assessment: { $in: assessments.map((a) => a._id) },
    });
    const byAssessment = new Map(subs.map((s) => [s.assessment.toString(), s]));
    const items = assessments.map((a) => {
      const view = toStudentView(a);
      const sub = byAssessment.get(a._id.toString());
      view.availableNow = isAvailableNow(a);
      view.submission = sub
        ? { id: sub.id, status: sub.status, score: sub.score, passed: sub.passed }
        : null;
      // Hide question payload from the list view (kept for the take screen).
      view.questionCount = view.questions.length;
      delete view.questions;
      return view;
    });
    return ok(res, items);
  }

  ok(res, assessments.map((a) => a.toJSON()));
}

export async function getAssessment(req, res) {
  const assessment = await Assessment.findById(req.params.id).populate('module', 'name code');
  if (!assessment) throw ApiError.notFound('Assessment not found');

  if (req.auth.role === UserRole.STUDENT) {
    const moduleIds = (await studentModuleIds(req.auth.userId)).map((m) => m.toString());
    if (!moduleIds.includes(assessment.module._id.toString())) {
      throw ApiError.forbidden('This assessment is not part of your curriculum');
    }
    if (!isAvailableNow(assessment)) {
      throw ApiError.forbidden('This assessment is locked or not currently available');
    }
    return ok(res, toStudentView(assessment));
  }

  ok(res, assessment.toJSON());
}

// ── Create / update / delete (admin or assigned trainer) ──────────────────────

export async function createAssessment(req, res) {
  const data = req.body;

  // A trainer may only author for modules they're assigned to.
  const module = await Module.findById(data.module).select('assignedTrainers');
  if (!module) throw ApiError.badRequest('Module not found');
  if (req.auth.role === UserRole.TRAINER) {
    const assigned = module.assignedTrainers.some((t) => t.toString() === req.auth.userId);
    if (!assigned) throw ApiError.forbidden('You are not assigned to this module');
  }

  // Enforce one assessment per (module, practiceIndex) and a single final per module.
  if (data.type === AssessmentType.PRACTICE) {
    if (await Assessment.findOne({ module: data.module, type: AssessmentType.PRACTICE, practiceIndex: data.practiceIndex })) {
      throw ApiError.conflict(`Practice Test ${data.practiceIndex} already exists for this module`);
    }
  } else if (await Assessment.findOne({ module: data.module, type: AssessmentType.FINAL })) {
    throw ApiError.conflict('A final assessment already exists for this module');
  }

  const settings = await getSettings();
  const assessment = await Assessment.create({
    title: data.title,
    module: data.module,
    type: data.type,
    practiceIndex: data.type === AssessmentType.PRACTICE ? data.practiceIndex : undefined,
    passingScore: data.passingScore ?? settings.passingScore,
    availableFrom: data.availableFrom,
    deadline: data.deadline,
    questions: data.questions ?? [],
    availability: AssessmentAvailability.LOCKED, // always starts locked
  });
  ok(res, assessment.toJSON(), 201);
}

export async function updateAssessment(req, res) {
  const assessment = await loadAssessmentForManage(req);
  const { title, passingScore, availableFrom, deadline } = req.body;
  if (title !== undefined) assessment.title = title;
  if (passingScore !== undefined) assessment.passingScore = passingScore;
  if (availableFrom !== undefined) assessment.availableFrom = availableFrom ?? undefined;
  if (deadline !== undefined) assessment.deadline = deadline ?? undefined;
  await assessment.save();
  ok(res, assessment.toJSON());
}

export async function deleteAssessment(req, res) {
  const assessment = await loadAssessmentForManage(req);
  const submissionCount = await Submission.countDocuments({ assessment: assessment._id });
  if (submissionCount > 0) {
    throw ApiError.conflict('Cannot delete an assessment that already has submissions');
  }
  await assessment.deleteOne();
  ok(res, { id: req.params.id, deleted: true });
}

// ── Lock / unlock (the trainer-controlled gate) ───────────────────────────────

export async function unlockAssessment(req, res) {
  const assessment = await loadAssessmentForManage(req);
  assessment.availability = AssessmentAvailability.UNLOCKED;
  assessment.unlockedBy = req.auth.userId;
  if (req.body.availableFrom !== undefined) assessment.availableFrom = req.body.availableFrom;
  if (req.body.deadline !== undefined) assessment.deadline = req.body.deadline;
  await assessment.save();
  ok(res, assessment.toJSON());
}

export async function lockAssessment(req, res) {
  const assessment = await loadAssessmentForManage(req);
  assessment.availability = AssessmentAvailability.LOCKED;
  await assessment.save();
  ok(res, assessment.toJSON());
}

// ── Question authoring ─────────────────────────────────────────────────────────

export async function addQuestion(req, res) {
  const assessment = await loadAssessmentForManage(req);
  assessment.questions.push(req.body);
  await assessment.save();
  ok(res, assessment.toJSON(), 201);
}

/** Bulk-add questions (e.g. from an Excel/CSV import). */
export async function addQuestionsBulk(req, res) {
  const assessment = await loadAssessmentForManage(req);
  for (const q of req.body.questions) assessment.questions.push(q);
  await assessment.save();
  ok(res, assessment.toJSON(), 201);
}

export async function updateQuestion(req, res) {
  const assessment = await loadAssessmentForManage(req);
  const q = assessment.questions.id(req.params.questionId);
  if (!q) throw ApiError.notFound('Question not found');
  Object.assign(q, req.body);
  await assessment.save();
  ok(res, assessment.toJSON());
}

export async function deleteQuestion(req, res) {
  const assessment = await loadAssessmentForManage(req);
  const q = assessment.questions.id(req.params.questionId);
  if (!q) throw ApiError.notFound('Question not found');
  q.deleteOne();
  await assessment.save();
  ok(res, assessment.toJSON());
}

// Re-export availability helper for the submission controller.
export { isAvailableNow };
