import { z } from 'zod';
import { UserRole } from '@lms/shared';
import { Announcement, Batch, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';

const objectId = z.string().length(24);
export const announcementIdParam = z.object({ id: objectId });

export const createAnnouncementSchema = z
  .object({
    title: z.string().min(2, 'Title must be at least 2 characters').max(160),
    body: z.string().min(1, 'Message cannot be empty').max(4000),
    batch: objectId.optional(),
    module: objectId.optional(),
    isGlobal: z.boolean().optional(),
  })
  .refine((d) => d.isGlobal || d.batch || d.module, {
    message: 'Target a batch, a module, or post globally',
  });

const POP = [
  { path: 'author', select: 'name role' },
  { path: 'batch', select: 'name code' },
  { path: 'module', select: 'name code' },
];

export async function createAnnouncement(req, res) {
  const { role, userId } = req.auth;
  const { title, body, batch, module, isGlobal } = req.body;

  if (role === UserRole.TRAINER) {
    if (isGlobal) throw ApiError.forbidden('Only admins can post global announcements');
    const me = await User.findById(userId).select('assignedBatches assignedModules');
    const okBatch = batch && me?.assignedBatches?.some((b) => b.toString() === batch);
    const okModule = module && me?.assignedModules?.some((m) => m.toString() === module);
    if (!okBatch && !okModule) {
      throw ApiError.forbidden('You can only post to your assigned batches or modules');
    }
  }

  const doc = await Announcement.create({
    author: userId,
    authorRole: role,
    title,
    body,
    batch,
    module,
    isGlobal: role === UserRole.ADMIN ? Boolean(isGlobal) : false,
  });
  const populated = await Announcement.findById(doc._id).populate(POP);
  ok(res, populated.toJSON(), 201);
}

/** Role-aware feed, newest first. */
export async function listAnnouncements(req, res) {
  const { role, userId } = req.auth;
  let filter = {};

  if (role === UserRole.STUDENT) {
    const me = await User.findById(userId).select('batch');
    const batch = me?.batch ? await Batch.findById(me.batch).select('modules') : null;
    filter = {
      $or: [
        { isGlobal: true },
        ...(me?.batch ? [{ batch: me.batch }] : []),
        ...(batch?.modules?.length ? [{ module: { $in: batch.modules } }] : []),
      ],
    };
  } else if (role === UserRole.TRAINER) {
    const me = await User.findById(userId).select('assignedBatches assignedModules');
    filter = {
      $or: [
        { author: userId },
        { isGlobal: true },
        { batch: { $in: me?.assignedBatches ?? [] } },
        { module: { $in: me?.assignedModules ?? [] } },
      ],
    };
  }
  // admin: all

  const items = await Announcement.find(filter).sort({ createdAt: -1 }).limit(200).populate(POP);
  ok(res, items.map((a) => a.toJSON()));
}

/** Author or admin may delete. */
export async function deleteAnnouncement(req, res) {
  const ann = await Announcement.findById(req.params.id);
  if (!ann) throw ApiError.notFound('Announcement not found');
  if (req.auth.role !== UserRole.ADMIN && ann.author.toString() !== req.auth.userId) {
    throw ApiError.forbidden('You can only delete your own announcements');
  }
  await ann.deleteOne();
  ok(res, { id: req.params.id, deleted: true });
}
