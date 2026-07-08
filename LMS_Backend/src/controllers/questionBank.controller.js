import { z } from 'zod';
import { QuestionType, UserRole } from '#shared';
import { Module, QuestionBankItem } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';

const objectId = z.string().length(24);

export const bankItemParam = z.object({ itemId: objectId });

export const listBankQuery = z.object({
  module: objectId.optional(),
  topic: objectId.optional(),
});

/** A single question payload (shared by manual add + bulk import). */
const questionInput = z
  .object({
    type: z.nativeEnum(QuestionType).default(QuestionType.MCQ),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).optional(),
    correctOption: z.number().int().min(0).optional(),
    referenceAnswer: z.string().max(5000).optional(),
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

export const createBankItemSchema = z
  .object({
    module: objectId,
    topic: objectId.optional().nullable(),
    type: z.nativeEnum(QuestionType).default(QuestionType.MCQ),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).optional(),
    correctOption: z.number().int().min(0).optional(),
    referenceAnswer: z.string().max(5000).optional(),
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

export const bulkBankSchema = z.object({
  module: objectId,
  topic: objectId.optional().nullable(),
  items: z.array(questionInput).min(1, 'No questions to import').max(1000),
});

export const updateBankItemSchema = z
  .object({
    prompt: z.string().min(1).optional(),
    type: z.nativeEnum(QuestionType).optional(),
    options: z.array(z.string().min(1)).optional(),
    correctOption: z.number().int().min(0).optional(),
    referenceAnswer: z.string().max(5000).optional(),
    points: z.number().int().min(1).max(100).optional(),
    topic: objectId.optional().nullable(),
  })
  .superRefine((q, ctx) => {
    if (q.type === QuestionType.MCQ && q.options && q.options.length < 2) {
      ctx.addIssue({ code: 'custom', message: 'MCQ needs at least 2 options', path: ['options'] });
    }
  });

// ── Authorization helpers ─────────────────────────────────────────────────────

/** Load a module the caller may manage (admin always; trainer must be assigned). */
async function loadManageableModule(req, moduleId) {
  const module = await Module.findById(moduleId).select('assignedTrainers topics');
  if (!module) throw ApiError.badRequest('Module not found');
  if (req.auth.role === UserRole.TRAINER) {
    const assigned = module.assignedTrainers.some((t) => t.toString() === req.auth.userId);
    if (!assigned) throw ApiError.forbidden('You are not assigned to this module');
  }
  return module;
}

/** Resolve a topic id to its title within a module (empty string for null/unknown). */
function topicTitleOf(module, topicId) {
  if (!topicId) return '';
  const t = module.topics.id(topicId);
  return t?.title ?? '';
}

// ── Handlers ───────────────────────────────────────────────────────────────────

export async function listBankItems(req, res) {
  const { role, userId } = req.auth;
  const filter = {};

  if (req.query.module) {
    await loadManageableModule(req, req.query.module); // authorize
    filter.module = req.query.module;
  } else if (role === UserRole.TRAINER) {
    // No module filter → scope to the trainer's assigned modules.
    const mine = await Module.find({ assignedTrainers: userId }).select('_id');
    filter.module = { $in: mine.map((m) => m._id) };
  }
  if (req.query.topic) filter.topic = req.query.topic;

  const items = await QuestionBankItem.find(filter).sort({ createdAt: -1 });
  ok(res, items.map((i) => i.toJSON()));
}

export async function createBankItem(req, res) {
  const module = await loadManageableModule(req, req.body.module);
  const item = await QuestionBankItem.create({
    module: req.body.module,
    topic: req.body.topic ?? null,
    topicTitle: topicTitleOf(module, req.body.topic),
    type: req.body.type,
    prompt: req.body.prompt,
    options: req.body.options ?? [],
    correctOption: req.body.correctOption,
    // MCQ is graded deterministically, so it never carries a reference answer.
    referenceAnswer: req.body.type === QuestionType.MCQ ? '' : (req.body.referenceAnswer ?? ''),
    points: req.body.points,
    createdBy: req.auth.userId,
  });
  ok(res, item.toJSON(), 201);
}

/** Bulk insert (Excel import parsed client-side, sent as JSON). */
export async function bulkAddBankItems(req, res) {
  const module = await loadManageableModule(req, req.body.module);
  const title = topicTitleOf(module, req.body.topic);
  const docs = req.body.items.map((q) => ({
    module: req.body.module,
    topic: req.body.topic ?? null,
    topicTitle: title,
    type: q.type,
    prompt: q.prompt,
    options: q.options ?? [],
    correctOption: q.correctOption,
    referenceAnswer: q.type === QuestionType.MCQ ? '' : (q.referenceAnswer ?? ''),
    points: q.points,
    createdBy: req.auth.userId,
  }));
  const created = await QuestionBankItem.insertMany(docs);
  ok(res, { added: created.length }, 201);
}

export async function updateBankItem(req, res) {
  const item = await QuestionBankItem.findById(req.params.itemId);
  if (!item) throw ApiError.notFound('Question not found');
  const module = await loadManageableModule(req, item.module); // authorize on its module
  const { prompt, type, options, correctOption, referenceAnswer, points, topic } = req.body;
  if (prompt !== undefined) item.prompt = prompt;
  if (type !== undefined) item.type = type;
  if (options !== undefined) item.options = options;
  if (correctOption !== undefined) item.correctOption = correctOption;
  if (referenceAnswer !== undefined) item.referenceAnswer = referenceAnswer;
  if (points !== undefined) item.points = points;
  // Switching a question to MCQ clears any leftover reference answer.
  if ((type ?? item.type) === QuestionType.MCQ) item.referenceAnswer = '';
  if (topic !== undefined) {
    item.topic = topic ?? null;
    item.topicTitle = topicTitleOf(module, topic);
  }
  await item.save();
  ok(res, item.toJSON());
}

export async function deleteBankItem(req, res) {
  const item = await QuestionBankItem.findById(req.params.itemId);
  if (!item) throw ApiError.notFound('Question not found');
  await loadManageableModule(req, item.module); // authorize
  await item.deleteOne();
  ok(res, { id: req.params.itemId, deleted: true });
}
