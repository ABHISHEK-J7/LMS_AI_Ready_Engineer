import { z } from 'zod';
import { AssessmentAvailability, AssessmentType, ProctoringMode, SubmissionStatus, UserRole } from '#shared';
import {
  Assessment,
  Batch,
  Module,
  QuestionBankItem,
  Submission,
  User,
  getSettings,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';
import { sebStatus } from '../services/seb.js';
import { audit } from '../services/audit.js';

const objectId = z.string().length(24);

export const assessmentIdParam = z.object({ id: objectId });
export const questionParam = z.object({ id: objectId, questionId: objectId });

export const listAssessmentsQuery = z.object({
  module: objectId.optional(),
  type: z.nativeEnum(AssessmentType).optional(),
});

export const createAssessmentSchema = z
  .object({
    // The trainer names the test freely; `type` is just the category
    // (practice / preparation / final). Any number of each is allowed.
    title: z.string().min(2),
    module: objectId,
    batch: objectId.optional(),
    type: z.nativeEnum(AssessmentType),
    topic: objectId.optional().nullable(),
    passingScore: z.number().int().min(0).max(100).optional(),
    availableFrom: z.coerce.date().optional(),
    deadline: z.coerce.date().optional(),
    durationMinutes: z.number().int().min(1).max(600).optional(),
    proctoring: z.nativeEnum(ProctoringMode).optional(),
    // Questions are sourced from the module's question bank (hand-picked).
    questionIds: z.array(objectId).optional(),
  })
  .superRefine((d, ctx) => {
    // Only practice tests may be topic-scoped; prep/final cover the whole module.
    if (d.topic && d.type !== AssessmentType.PRACTICE) {
      ctx.addIssue({ code: 'custom', message: 'Only practice tests can target a specific topic', path: ['topic'] });
    }
    validateWindow(d, ctx);
  });

export const fromBankSchema = z.object({
  questionIds: z.array(objectId).min(1, 'Pick at least one question'),
});

export const setAllowedStudentsSchema = z.object({
  // Empty array = the whole batch may take the assessment.
  studentIds: z.array(objectId),
});

export const updateAssessmentSchema = z
  .object({
    title: z.string().min(2).optional(),
    passingScore: z.number().int().min(0).max(100).optional(),
    availableFrom: z.coerce.date().optional().nullable(),
    deadline: z.coerce.date().optional().nullable(),
    durationMinutes: z.number().int().min(1).max(600).optional().nullable(),
    proctoring: z.nativeEnum(ProctoringMode).optional(),
  })
  .superRefine((d, ctx) => validateWindow(d, ctx));

export const unlockSchema = z.object({
  availableFrom: z.coerce.date().optional(),
  deadline: z.coerce.date().optional(),
});

/** Window/duration sanity used by create + update: start < end, and the per-
 *  student duration can't exceed the whole window. */
function validateWindow(d, ctx) {
  if (d.availableFrom && d.deadline) {
    if (d.availableFrom >= d.deadline) {
      ctx.addIssue({ code: 'custom', message: 'Window end time must be after the start time', path: ['deadline'] });
    } else if (d.durationMinutes) {
      const windowMin = (d.deadline.getTime() - d.availableFrom.getTime()) / 60000;
      if (d.durationMinutes > windowMin) {
        ctx.addIssue({ code: 'custom', message: 'Test duration cannot be longer than the test window', path: ['durationMinutes'] });
      }
    }
  }
}

/** Effective end of a started attempt: min(start + duration, window deadline). */
export function attemptEndsAt(assessment, startedAt) {
  if (!startedAt) return null;
  const ends = [];
  if (assessment.durationMinutes) ends.push(startedAt.getTime() + assessment.durationMinutes * 60000);
  if (assessment.deadline) ends.push(new Date(assessment.deadline).getTime());
  if (!ends.length) return null;
  return new Date(Math.min(...ends));
}

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

/**
 * Batch + per-student scoping. A student may access an assessment only if it is
 * assigned to their batch, and — when an explicit allow-list is set — only if they
 * are on it. Legacy assessments with no batch keep the old (module-curriculum) rule.
 * The `batch` arg may be an id or a populated doc.
 */
function studentMayAccess(assessment, studentBatch, studentId) {
  if (!assessment.batch) return true; // legacy: visible to the whole module curriculum
  const assessmentBatchId = assessment.batch._id ? assessment.batch._id.toString() : assessment.batch.toString();
  const studentBatchId = studentBatch?._id ? studentBatch._id.toString() : studentBatch?.toString();
  if (!studentBatchId || assessmentBatchId !== studentBatchId) return false;
  const allow = assessment.allowedStudents ?? [];
  if (allow.length === 0) return true; // whole batch
  return allow.some((s) => (s._id ? s._id.toString() : s.toString()) === studentId.toString());
}

/**
 * A student may only attempt a module's FINAL after attempting EVERY preparation
 * test that exists for the module (regardless of current lock state — re-locking
 * a prep doesn't shrink the requirement, and a leftover attempt still counts).
 * Returns { gated, reason, pending } where `pending` is the titles still to do.
 */
async function finalGateForStudent(moduleId, studentId) {
  // Gate against ALL preparation tests defined for the module, not just the
  // currently-unlocked subset (fixes the 1-prep / re-lock bypass).
  const preps = await Assessment.find({
    module: moduleId,
    type: AssessmentType.PREPARATION,
  }).select('_id title');

  if (!preps.length) {
    // No preps configured yet → the final isn't reachable until the trainer sets them up.
    return { gated: true, reason: 'Preparation tests for this module haven’t been set up yet.', pending: [] };
  }

  const subs = await Submission.find({
    student: studentId,
    assessment: { $in: preps.map((p) => p._id) },
    status: { $ne: SubmissionStatus.NOT_STARTED },
    disqualified: { $ne: true }, // a kicked-out attempt doesn't count as "attempted"
  }).select('assessment');
  const done = new Set(subs.map((s) => s.assessment.toString()));
  const pending = preps.filter((p) => !done.has(p._id.toString())).map((p) => p.title);

  return {
    gated: pending.length > 0,
    reason: pending.length ? `Attempt all ${preps.length} preparation test(s) before taking the final.` : null,
    pending,
  };
}

/** Strip everything a student must never see from a question (answer key + rubric). */
function sanitizeQuestion(q) {
  const { correctOption, referenceAnswer, ...rest } = q;
  return rest;
}

/** Remove roster/allow-list internals a student should never receive. */
function stripBatchInternals(json) {
  delete json.allowedStudents;
  if (json.batch && typeof json.batch === 'object') delete json.batch.students;
  return json;
}

/** Student-facing projection: never leak the correct answer, rubric, or batch roster. */
function toStudentView(a) {
  const json = stripBatchInternals(a.toJSON());
  json.questions = json.questions.map(sanitizeQuestion);
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

  let myBatchId = null;
  if (role === UserRole.STUDENT) {
    const me = await User.findById(userId).select('batch');
    myBatchId = me?.batch ?? null;
    const batch = myBatchId ? await Batch.findById(myBatchId).select('modules') : null;
    filter.module = { $in: batch?.modules ?? [] };
    filter.availability = AssessmentAvailability.UNLOCKED; // students only see unlocked
  } else if (req.query.module) {
    filter.module = req.query.module;
  }

  let assessments = await Assessment.find(filter)
    .sort({ module: 1, type: 1, createdAt: 1 })
    .populate('module', 'name code');

  if (role === UserRole.STUDENT) {
    // Batch + per-student allow-list scoping (legacy no-batch tests stay visible).
    assessments = assessments.filter((a) => studentMayAccess(a, myBatchId, userId));
    // Attach the student's submission summary + a computed "available now" flag.
    const subs = await Submission.find({
      student: userId,
      assessment: { $in: assessments.map((a) => a._id) },
    });
    const byAssessment = new Map(subs.map((s) => [s.assessment.toString(), s]));
    const items = await Promise.all(
      assessments.map(async (a) => {
        const view = toStudentView(a);
        const sub = byAssessment.get(a._id.toString());
        view.availableNow = isAvailableNow(a);
        // Finals are additionally gated until every preparation test is attempted.
        if (a.type === AssessmentType.FINAL && view.availableNow) {
          const gate = await finalGateForStudent(a.module._id, userId);
          if (gate.gated) {
            view.availableNow = false;
            view.gated = true;
            view.gateReason = gate.reason;
            view.gatePending = gate.pending;
          }
        }
        view.submission = sub
          ? { id: sub.id, status: sub.status, score: sub.score, passed: sub.passed, startedAt: sub.startedAt ?? null }
          : null;
        // Hide question payload from the list view (kept for the take screen).
        view.questionCount = view.questions.length;
        delete view.questions;
        return view;
      }),
    );
    return ok(res, items);
  }

  ok(res, assessments.map((a) => a.toJSON()));
}

export async function getAssessment(req, res) {
  // Staff (admin/trainer) get the batch's student roster populated so the Manage
  // screen can render the allow-list chips.
  const assessment = await Assessment.findById(req.params.id)
    .populate('module', 'name code')
    .populate({ path: 'batch', select: 'name code', populate: { path: 'students', select: 'name email status' } });
  if (!assessment) throw ApiError.notFound('Assessment not found');

  if (req.auth.role === UserRole.STUDENT) {
    const me = await User.findById(req.auth.userId).select('batch');
    const moduleIds = (await studentModuleIds(req.auth.userId)).map((m) => m.toString());
    if (!moduleIds.includes(assessment.module._id.toString())) {
      throw ApiError.forbidden('This assessment is not part of your curriculum');
    }
    // Batch + allow-list scoping (skipped for a student who already has a submission,
    // so they can always review their own past attempt below).
    const hasSubmission = await Submission.exists({ assessment: assessment._id, student: req.auth.userId });
    if (!hasSubmission && !studentMayAccess(assessment, me?.batch, req.auth.userId)) {
      throw ApiError.forbidden('This assessment is not assigned to you');
    }

    // If the student already has a submission, this is a RESULT view — show the
    // full questions (with correct answers) for review, regardless of whether the
    // window has since closed or the test is now locked.
    const mySub = await Submission.findOne({ assessment: assessment._id, student: req.auth.userId }).select('status startedAt');
    const reviewable = mySub && [SubmissionStatus.SUBMITTED, SubmissionStatus.EVALUATING, SubmissionStatus.GRADED].includes(mySub.status);
    if (reviewable) {
      // Anti-leak: for a proctored test, hold the questions + correct answers until
      // the exam window has fully closed (others may still be taking it). The score
      // and leaderboard remain visible; the answer review unlocks after the window.
      const heldUntil =
        assessment.proctored && assessment.deadline && Date.now() < new Date(assessment.deadline).getTime()
          ? assessment.deadline
          : null;
      const full = stripBatchInternals(assessment.toJSON());
      full.review = true;
      if (heldUntil) {
        full.questions = [];
        full.answersLockedUntil = heldUntil;
      } else {
        // Review keeps the MCQ correct answers (so students learn) but never the
        // trainer's private grading rubric / model answer.
        full.questions = full.questions.map(({ referenceAnswer, ...rest }) => rest);
      }
      return ok(res, full);
    }

    if (!isAvailableNow(assessment)) {
      throw ApiError.forbidden('This assessment is locked or not currently available');
    }
    if (assessment.type === AssessmentType.FINAL) {
      const gate = await finalGateForStudent(assessment.module._id, req.auth.userId);
      if (gate.gated) throw ApiError.forbidden(gate.reason);
    }

    const view = toStudentView(assessment);
    if (assessment.proctored) {
      // Safe Exam Browser status drives the launch screen on the take page.
      Object.assign(view, await sebStatus(req, assessment));
      const inProgress = mySub && mySub.startedAt && mySub.status === SubmissionStatus.IN_PROGRESS;
      view.serverNow = new Date();
      view.attempt = {
        status: mySub?.status ?? SubmissionStatus.NOT_STARTED,
        startedAt: mySub?.startedAt ?? null,
        endsAt: inProgress ? attemptEndsAt(assessment, mySub.startedAt) : null,
      };
      // Questions are revealed only once the timed attempt has started.
      if (!inProgress) {
        view.questionCount = view.questions.length;
        view.questions = [];
        view.mustStart = true;
      }
    }
    return ok(res, view);
  }

  ok(res, assessment.toJSON());
}

// ── Create / update / delete (admin or assigned trainer) ──────────────────────

/** Load module-bank items by id, validating they belong to `moduleId`, and
 *  return assessment-question snapshots (so later bank edits never change a test). */
async function snapshotsFromBank(questionIds, moduleId) {
  if (!questionIds?.length) return [];
  const items = await QuestionBankItem.find({ _id: { $in: questionIds }, module: moduleId });
  if (items.length !== new Set(questionIds).size) {
    throw ApiError.badRequest('Some selected questions are not in this module’s question bank');
  }
  return items.map((q) => ({
    type: q.type,
    prompt: q.prompt,
    options: q.options,
    correctOption: q.correctOption,
    referenceAnswer: q.referenceAnswer || '',
    points: q.points,
    sourceId: q._id,
  }));
}

export async function createAssessment(req, res) {
  const data = req.body;

  // A trainer may only author for modules they're assigned to.
  const module = await Module.findById(data.module).select('assignedTrainers topics');
  if (!module) throw ApiError.badRequest('Module not found');
  if (req.auth.role === UserRole.TRAINER) {
    const assigned = module.assignedTrainers.some((t) => t.toString() === req.auth.userId);
    if (!assigned) throw ApiError.forbidden('You are not assigned to this module');
  }

  // Any number of practice / preparation tests may exist per module (each named
  // by the trainer). A module still has exactly one final.
  if (data.type === AssessmentType.FINAL && (await Assessment.findOne({ module: data.module, type: AssessmentType.FINAL }))) {
    throw ApiError.conflict('A final assessment already exists for this module');
  }

  // Resolve + validate the batch this assessment is assigned to. Only that batch's
  // students will see it. The batch must carry this module, and a trainer must belong
  // to the batch.
  let batchId = null;
  if (data.batch) {
    const batch = await Batch.findById(data.batch).select('modules trainers');
    if (!batch) throw ApiError.badRequest('Batch not found');
    if (!batch.modules.some((m) => m.toString() === data.module)) {
      throw ApiError.badRequest('That batch does not include this module');
    }
    if (req.auth.role === UserRole.TRAINER && !batch.trainers.some((t) => t.toString() === req.auth.userId)) {
      throw ApiError.forbidden('You are not a trainer on that batch');
    }
    batchId = batch._id;
  }

  // Resolve the optional topic (practice tests only) to its title.
  let topicTitle = '';
  if (data.topic) {
    const t = module.topics.id(data.topic);
    if (!t) throw ApiError.badRequest('Topic not found in this module');
    topicTitle = t.title;
  }

  const questions = await snapshotsFromBank(data.questionIds, data.module);

  // Invigilation mode is chosen per test. Default: practice = none, prep/final = built-in app.
  const proctoring = data.proctoring
    ?? (data.type === AssessmentType.PRACTICE ? ProctoringMode.NONE : ProctoringMode.APP);
  const proctored = proctoring !== ProctoringMode.NONE; // app/seb run the timed exam flow
  const requireSeb = proctoring === ProctoringMode.SEB;

  const settings = await getSettings();
  const assessment = await Assessment.create({
    title: data.title,
    module: data.module,
    batch: batchId,
    type: data.type,
    topic: data.type === AssessmentType.PRACTICE ? (data.topic ?? null) : null,
    topicTitle: data.type === AssessmentType.PRACTICE ? topicTitle : '',
    passingScore: data.passingScore ?? settings.passingScore,
    availableFrom: data.availableFrom,
    deadline: data.deadline,
    proctoring,
    proctored,
    requireSeb,
    durationMinutes: proctored ? data.durationMinutes : undefined,
    questions,
    availability: AssessmentAvailability.LOCKED, // always starts locked
  });
  ok(res, assessment.toJSON(), 201);
}

export async function updateAssessment(req, res) {
  const assessment = await loadAssessmentForManage(req);
  const { title, passingScore, availableFrom, deadline, durationMinutes, proctoring } = req.body;
  if (title !== undefined) assessment.title = title;
  if (passingScore !== undefined) assessment.passingScore = passingScore;
  if (availableFrom !== undefined) assessment.availableFrom = availableFrom ?? undefined;
  if (deadline !== undefined) assessment.deadline = deadline ?? undefined;
  if (durationMinutes !== undefined) assessment.durationMinutes = durationMinutes ?? undefined;
  if (proctoring !== undefined) {
    assessment.proctoring = proctoring;
    assessment.proctored = proctoring !== ProctoringMode.NONE;
    assessment.requireSeb = proctoring === ProctoringMode.SEB;
    if (!assessment.proctored) assessment.durationMinutes = undefined;
  }
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
  if (req.body.availableFrom !== undefined) assessment.availableFrom = req.body.availableFrom;
  if (req.body.deadline !== undefined) assessment.deadline = req.body.deadline;

  if (assessment.questions.length === 0) {
    throw ApiError.badRequest('Add at least one question before unlocking.');
  }
  // A proctored exam needs a valid window + duration before students can take it.
  if (assessment.proctored) {
    const { availableFrom, deadline, durationMinutes } = assessment;
    if (!availableFrom || !deadline || !durationMinutes) {
      throw ApiError.badRequest('Set the test date, window (start–end), and duration before unlocking.');
    }
    if (availableFrom >= deadline) {
      throw ApiError.badRequest('The test window end must be after its start.');
    }
    if (durationMinutes * 60000 > deadline.getTime() - availableFrom.getTime()) {
      throw ApiError.badRequest('The test duration cannot be longer than the test window.');
    }
  }

  assessment.availability = AssessmentAvailability.UNLOCKED;
  assessment.unlockedBy = req.auth.userId;
  await assessment.save();
  audit(req, 'assessment.unlock', { targetType: 'assessment', targetId: assessment.id, meta: { title: assessment.title } });
  ok(res, assessment.toJSON());
}

export async function lockAssessment(req, res) {
  const assessment = await loadAssessmentForManage(req);
  assessment.availability = AssessmentAvailability.LOCKED;
  await assessment.save();
  audit(req, 'assessment.lock', { targetType: 'assessment', targetId: assessment.id, meta: { title: assessment.title } });
  ok(res, assessment.toJSON());
}

// ── Building a test from the question bank ────────────────────────────────────

/** Hand-pick questions from the module's bank and snapshot them into the test. */
export async function addQuestionsFromBank(req, res) {
  const assessment = await loadAssessmentForManage(req);
  const snapshots = await snapshotsFromBank(req.body.questionIds, assessment.module);
  // Skip bank questions already added to this test (by source id).
  const already = new Set(assessment.questions.map((q) => q.sourceId?.toString()).filter(Boolean));
  let added = 0;
  for (const q of snapshots) {
    if (q.sourceId && already.has(q.sourceId.toString())) continue;
    assessment.questions.push(q);
    added += 1;
  }
  await assessment.save();
  ok(res, { ...assessment.toJSON(), added }, 201);
}

/**
 * Set the per-student allow-list for an assessment (from the Manage screen's chips
 * / Excel-of-emails). Every id must be a student in the assessment's batch. An empty
 * list means "the whole batch may take it".
 */
export async function setAllowedStudents(req, res) {
  const assessment = await loadAssessmentForManage(req);
  if (!assessment.batch) throw ApiError.badRequest('Assign a batch to this assessment first');

  const batch = await Batch.findById(assessment.batch).select('students');
  const inBatch = new Set((batch?.students ?? []).map((s) => s.toString()));
  const ids = [...new Set(req.body.studentIds)];
  const stray = ids.filter((id) => !inBatch.has(id));
  if (stray.length) throw ApiError.badRequest('Some selected students are not in this assessment’s batch');

  assessment.allowedStudents = ids;
  await assessment.save();
  audit(req, 'assessment.allowedStudents', { targetType: 'assessment', targetId: assessment.id, meta: { count: ids.length } });
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

// Re-export helpers for the submission controller.
export { isAvailableNow, finalGateForStudent, studentMayAccess };
