import { z } from 'zod';
import { DoubtStatus, UserRole } from '#shared';
import { Doubt, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';

const objectId = z.string().length(24);

export const doubtIdParam = z.object({ id: objectId });

export const createDoubtSchema = z.object({
  title: z.string().min(3).max(160),
  body: z.string().min(1).max(4000),
  module: objectId, // a doubt is always raised against a specific module
});

export const replySchema = z.object({ body: z.string().min(1).max(4000) });

export const closeSchema = z.object({ rating: z.number().int().min(1).max(5) });

export const listDoubtsQuery = z.object({
  status: z.nativeEnum(DoubtStatus).optional(),
  module: objectId.optional(),
});

const POP = [
  { path: 'student', select: 'name email' },
  { path: 'module', select: 'name code' },
  { path: 'messages.author', select: 'name role' },
  { path: 'answeredBy', select: 'name' },
];

/** Can this trainer act on / see this doubt? (assigned to its module or batch) */
function trainerOwns(trainer, doubt) {
  const inModule = doubt.module && trainer.assignedModules?.some((m) => m.toString() === doubt.module.toString());
  const inBatch = doubt.batch && trainer.assignedBatches?.some((b) => b.toString() === doubt.batch.toString());
  return Boolean(inModule || inBatch);
}

// ── Create (student) ──────────────────────────────────────────────────────────

export async function createDoubt(req, res) {
  const { title, body, module } = req.body;

  // One doubt per module per student: block a second one while an earlier doubt
  // in this module is still unresolved (not closed).
  const existing = await Doubt.findOne({
    student: req.auth.userId,
    module,
    status: { $ne: DoubtStatus.CLOSED },
  });
  if (existing) {
    throw ApiError.badRequest('You already have an open doubt in this module. Close it before asking another.');
  }

  const me = await User.findById(req.auth.userId).select('batch');
  const doubt = await Doubt.create({
    student: req.auth.userId,
    module,
    batch: me?.batch,
    title,
    status: DoubtStatus.OPEN,
    messages: [{ author: req.auth.userId, authorRole: UserRole.STUDENT, body }],
  });
  const populated = await Doubt.findById(doubt._id).populate(POP);
  ok(res, populated.toJSON(), 201);
}

// ── Listing (role-aware) ──────────────────────────────────────────────────────

export async function listDoubts(req, res) {
  const { role, userId } = req.auth;
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.module) filter.module = req.query.module;

  if (role === UserRole.STUDENT) {
    filter.student = userId;
  } else if (role === UserRole.TRAINER) {
    const me = await User.findById(userId).select('assignedModules assignedBatches');
    filter.$or = [
      { module: { $in: me?.assignedModules ?? [] } },
      { batch: { $in: me?.assignedBatches ?? [] } },
    ];
  }
  // admin: no extra filter (all doubts)

  const doubts = await Doubt.find(filter).sort({ updatedAt: -1 }).limit(500).populate(POP);
  ok(res, doubts.map((d) => d.toJSON()));
}

/** Load a doubt and assert the requester may view it. */
async function loadViewable(req) {
  const doubt = await Doubt.findById(req.params.id).populate(POP);
  if (!doubt) throw ApiError.notFound('Doubt not found');
  const { role, userId } = req.auth;
  if (role === UserRole.ADMIN) return doubt;
  if (role === UserRole.STUDENT) {
    if (doubt.student._id.toString() !== userId) throw ApiError.forbidden('Not your doubt');
    return doubt;
  }
  // trainer
  const me = await User.findById(userId).select('assignedModules assignedBatches');
  if (!trainerOwns(me, doubt)) throw ApiError.forbidden('This doubt is outside your modules/batches');
  return doubt;
}

export async function getDoubt(req, res) {
  ok(res, (await loadViewable(req)).toJSON());
}

// ── Reply ─────────────────────────────────────────────────────────────────────

export async function addReply(req, res) {
  const { role, userId } = req.auth;
  const doubt = await Doubt.findById(req.params.id);
  if (!doubt) throw ApiError.notFound('Doubt not found');

  // Authorization: owning student, an assigned trainer, or admin.
  if (role === UserRole.STUDENT) {
    if (doubt.student.toString() !== userId) throw ApiError.forbidden('Not your doubt');
  } else if (role === UserRole.TRAINER) {
    const me = await User.findById(userId).select('assignedModules assignedBatches');
    if (!trainerOwns(me, doubt)) throw ApiError.forbidden('This doubt is outside your modules/batches');
  }

  doubt.messages.push({ author: userId, authorRole: role, body: req.body.body });
  // A trainer/admin reply answers the doubt; a student follow-up reopens it.
  if (role === UserRole.STUDENT) {
    if (doubt.status === DoubtStatus.ANSWERED) doubt.status = DoubtStatus.OPEN;
  } else if (doubt.status !== DoubtStatus.CLOSED) {
    doubt.status = DoubtStatus.ANSWERED;
    if (role === UserRole.TRAINER) doubt.answeredBy = userId; // who the student will rate
  }
  await doubt.save();

  // Notify the other party that there's a new reply.
  const { notify } = await import('../services/notify.js');
  if (role === UserRole.STUDENT) {
    if (doubt.answeredBy) notify(doubt.answeredBy, { type: 'doubt', title: `Reply on "${doubt.title}"`, body: 'The student followed up on a doubt.', link: '/app/doubts' });
  } else {
    notify(doubt.student, { type: 'doubt', title: `Your doubt was answered: "${doubt.title}"`, body: 'A trainer replied to your doubt.', link: '/app/doubts' });
  }

  const populated = await Doubt.findById(doubt._id).populate(POP);
  ok(res, populated.toJSON());
}

// ── Close + rate (STUDENT only) ────────────────────────────────────────────────

/** The owning student closes the doubt and rates the trainer (required). */
export async function closeDoubt(req, res) {
  const doubt = await Doubt.findById(req.params.id);
  if (!doubt) throw ApiError.notFound('Doubt not found');
  if (doubt.student.toString() !== req.auth.userId) throw ApiError.forbidden('Not your doubt');
  if (doubt.status === DoubtStatus.CLOSED) throw ApiError.badRequest('This doubt is already closed');
  if (doubt.status !== DoubtStatus.ANSWERED) {
    throw ApiError.badRequest('You can close a doubt only after a trainer has answered it.');
  }

  doubt.status = DoubtStatus.CLOSED;
  doubt.open = false; // leaves the partial-unique index → a new doubt in this module is allowed
  doubt.rating = req.body.rating;
  await doubt.save();
  ok(res, (await Doubt.findById(doubt._id).populate(POP)).toJSON());
}

// ── Trainer's own scoreboard ───────────────────────────────────────────────────

/** Doubts this trainer has answered + the average star rating they received. */
export async function myDoubtStats(req, res) {
  const trainerId = req.auth.userId;
  const answered = await Doubt.countDocuments({ answeredBy: trainerId });
  const resolved = await Doubt.countDocuments({ answeredBy: trainerId, status: DoubtStatus.CLOSED });
  const rated = await Doubt.find({ answeredBy: trainerId, rating: { $gte: 1 } }).select('rating');
  const ratingCount = rated.length;
  const averageRating = ratingCount
    ? Math.round((rated.reduce((s, d) => s + d.rating, 0) / ratingCount) * 10) / 10
    : 0;
  ok(res, { answered, resolved, ratingCount, averageRating });
}
