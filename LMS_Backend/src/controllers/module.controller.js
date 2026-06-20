import { z } from 'zod';
import { SkillLevel, UserRole } from '#shared';
import { Module, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';

const objectId = z.string().length(24);

export const moduleIdParam = z.object({ id: objectId });
export const topicParam = z.object({ id: objectId, topicId: objectId });
export const trainerParam = z.object({ id: objectId, trainerId: objectId });

export const createModuleSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(12),
  description: z.string().optional(),
  level: z.nativeEnum(SkillLevel).optional(),
  order: z.number().int().min(0).optional(),
  learningObjectives: z.array(z.string()).optional(),
});

export const updateModuleSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().min(2).max(12).optional(),
  description: z.string().optional(),
  level: z.nativeEnum(SkillLevel).optional(),
  order: z.number().int().min(0).optional(),
  learningObjectives: z.array(z.string()).optional(),
  archived: z.boolean().optional(),
});

export const reorderSchema = z.object({
  // ordered list of module ids -> assigns order by index
  order: z.array(objectId).min(1),
});

export const assignTrainerSchema = z.object({ trainerId: objectId });

// Dates arrive as 'YYYY-MM-DD' strings (or '' / null to clear).
const dateInput = z.union([z.string().max(40), z.null()]).optional();
const subtopicInput = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  fromDate: dateInput,
  toDate: dateInput,
});

export const topicSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  subtopics: z.array(subtopicInput).max(100).optional(),
});

export const updateTopicSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  order: z.number().int().min(0).optional(),
  completed: z.boolean().optional(),
  subtopics: z.array(subtopicInput).max(100).optional(),
});

/** Bulk syllabus import (from an uploaded Excel/CSV). Topics matched by title
 *  (case-insensitive) are updated; new titles are appended. */
export const importSyllabusSchema = z.object({
  topics: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        subtopics: z.array(subtopicInput).max(100).optional(),
      }),
    )
    .min(1, 'No topics to import')
    .max(200, 'Import at most 200 topics at a time'),
});

export const objectivesSchema = z.object({
  learningObjectives: z.array(z.string()),
});

/**
 * Load a module or 404. If the requester is a trainer, also assert they are
 * assigned to it (admins bypass). Returns the module document.
 */
async function loadModuleForEdit(req) {
  const module = await Module.findById(req.params.id);
  if (!module) throw ApiError.notFound('Module not found');
  if (req.auth.role === UserRole.TRAINER) {
    const assigned = module.assignedTrainers.some((t) => t.toString() === req.auth.userId);
    if (!assigned) throw ApiError.forbidden('You are not assigned to this module');
  }
  return module;
}

// ── Listing / reading ───────────────────────────────────────────────────────

/** Role-aware list. Admin: all (optional archived). Trainer: assigned only. Student: active curriculum. */
export async function listModules(req, res) {
  const { role, userId } = req.auth;
  const filter = {};

  if (role === UserRole.ADMIN) {
    if (req.query.archived !== 'true') filter.archived = false;
  } else if (role === UserRole.TRAINER) {
    filter.assignedTrainers = userId;
  } else {
    filter.archived = false;
  }

  const modules = await Module.find(filter)
    .sort({ order: 1 })
    .populate('assignedTrainers', 'name email');
  ok(res, modules.map((m) => m.toJSON()));
}

export async function getModule(req, res) {
  const module = await Module.findById(req.params.id).populate(
    'assignedTrainers',
    'name email',
  );
  if (!module) throw ApiError.notFound('Module not found');
  ok(res, module.toJSON());
}

// ── Admin CRUD ───────────────────────────────────────────────────────────────

export async function createModule(req, res) {
  const data = req.body;
  if (await Module.findOne({ code: data.code.toUpperCase() })) {
    throw ApiError.conflict(`A module with code ${data.code.toUpperCase()} already exists`);
  }
  // Default order to the end of the list when not provided.
  let order = data.order;
  if (order === undefined) {
    const last = await Module.findOne().sort({ order: -1 });
    order = last ? last.order + 1 : 1;
  }
  const module = await Module.create({ ...data, order });
  ok(res, module.toJSON(), 201);
}

export async function updateModule(req, res) {
  const module = await Module.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!module) throw ApiError.notFound('Module not found');
  ok(res, module.toJSON());
}

/** Soft archive (preserves curriculum/progress history). */
export async function archiveModule(req, res) {
  const module = await Module.findByIdAndUpdate(
    req.params.id,
    { archived: true },
    { new: true },
  );
  if (!module) throw ApiError.notFound('Module not found');
  ok(res, module.toJSON());
}

/** Bulk reorder: order[] of module ids, position = new order index (1-based). */
export async function reorderModules(req, res) {
  const { order } = req.body;
  await Promise.all(
    order.map((id, idx) => Module.findByIdAndUpdate(id, { order: idx + 1 })),
  );
  const modules = await Module.find({ archived: false }).sort({ order: 1 });
  ok(res, modules.map((m) => m.toJSON()));
}

// ── Trainer assignment (admin) ────────────────────────────────────────────────

export async function assignTrainer(req, res) {
  const { trainerId } = req.body;
  const trainer = await User.findById(trainerId);
  if (!trainer || trainer.role !== UserRole.TRAINER) {
    throw ApiError.badRequest('User is not a trainer');
  }
  const module = await Module.findById(req.params.id);
  if (!module) throw ApiError.notFound('Module not found');

  // Keep both sides of the relationship in sync, idempotently.
  await Module.updateOne({ _id: module._id }, { $addToSet: { assignedTrainers: trainerId } });
  await User.updateOne({ _id: trainerId }, { $addToSet: { assignedModules: module._id } });

  const updated = await Module.findById(module._id).populate('assignedTrainers', 'name email');
  ok(res, updated.toJSON());
}

export async function removeTrainer(req, res) {
  const { id, trainerId } = req.params;
  const module = await Module.findById(id);
  if (!module) throw ApiError.notFound('Module not found');

  await Module.updateOne({ _id: id }, { $pull: { assignedTrainers: trainerId } });
  await User.updateOne({ _id: trainerId }, { $pull: { assignedModules: id } });

  const updated = await Module.findById(id).populate('assignedTrainers', 'name email');
  ok(res, updated.toJSON());
}

// ── Syllabus: topics & objectives (admin OR assigned trainer) ─────────────────

export async function addTopic(req, res) {
  const module = await loadModuleForEdit(req);
  const order = module.topics.length;
  const { subtopics, ...rest } = req.body;
  module.topics.push({ ...rest, order, completed: false, subtopics: cleanSubs(subtopics) });
  await module.save();
  ok(res, module.toJSON(), 201);
}

export async function updateTopic(req, res) {
  const module = await loadModuleForEdit(req);
  const topic = module.topics.id(req.params.topicId);
  if (!topic) throw ApiError.notFound('Topic not found');
  const { subtopics, ...rest } = req.body;
  Object.assign(topic, rest);
  if (subtopics !== undefined) topic.subtopics = cleanSubs(subtopics);
  await module.save();
  ok(res, module.toJSON());
}

export async function deleteTopic(req, res) {
  const module = await loadModuleForEdit(req);
  const topic = module.topics.id(req.params.topicId);
  if (!topic) throw ApiError.notFound('Topic not found');
  topic.deleteOne();
  await module.save();
  ok(res, module.toJSON());
}

/**
 * Mark a syllabus section complete/incomplete. This is the trainer-controlled
 * signal that gates assessment unlocks in a later milestone.
 */
export async function setTopicCompletion(req, res) {
  const module = await loadModuleForEdit(req);
  const topic = module.topics.id(req.params.topicId);
  if (!topic) throw ApiError.notFound('Topic not found');
  topic.completed = Boolean(req.body.completed);
  await module.save();
  ok(res, module.toJSON());
}

export async function updateObjectives(req, res) {
  const module = await loadModuleForEdit(req);
  module.learningObjectives = req.body.learningObjectives;
  await module.save();
  ok(res, module.toJSON());
}

const toDate = (v) => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};
const cleanSubs = (subs = []) =>
  subs
    .map((s) => ({
      title: (s.title ?? '').trim(),
      description: (s.description ?? '').trim(),
      fromDate: toDate(s.fromDate),
      toDate: toDate(s.toDate),
    }))
    .filter((s) => s.title || s.description);

/**
 * Bulk-import a syllabus (topics + their subtopics) from a parsed spreadsheet.
 * Topics whose title already exists (case-insensitive) get their subtopics
 * replaced; brand-new titles are appended. Existing taught/resource state is
 * preserved for matched topics.
 */
export async function importSyllabus(req, res) {
  const module = await loadModuleForEdit(req);
  let added = 0;
  let updated = 0;
  for (const t of req.body.topics) {
    const title = t.title.trim();
    const subs = cleanSubs(t.subtopics);
    const existing = module.topics.find((x) => x.title.trim().toLowerCase() === title.toLowerCase());
    if (existing) {
      if (t.description !== undefined) existing.description = t.description;
      existing.subtopics = subs;
      updated += 1;
    } else {
      module.topics.push({
        title,
        description: t.description ?? '',
        order: module.topics.length,
        completed: false,
        subtopics: subs,
      });
      added += 1;
    }
  }
  await module.save();
  ok(res, { module: module.toJSON(), added, updated });
}
