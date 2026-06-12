import { z } from 'zod';
import { ClassStatus, MeetingProvider, UserRole } from '@lms/shared';
import { Batch, ClassJoin, ClassSchedule, Module, User } from '../models/index.js';
import { createZoomMeeting } from '../services/meetings.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';

const objectId = z.string().length(24);
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm (24h)');

export const classIdParam = z.object({ id: objectId });

export const listClassesQuery = z.object({
  batch: objectId.optional(),
  module: objectId.optional(),
  trainer: objectId.optional(),
  status: z.nativeEnum(ClassStatus).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const createClassSchema = z
  .object({
    title: z.string().min(2),
    module: objectId,
    batch: objectId,
    trainer: objectId.optional(), // defaults to caller when a trainer creates
    date: z.coerce.date(),
    startTime: timeStr,
    endTime: timeStr,
    provider: z.nativeEnum(MeetingProvider).optional(),
    meetingLink: z.string().url().optional().or(z.literal('')),
    // When true (and provider is zoom, no manual link), the backend creates a
    // Zoom meeting and fills in the join link.
    autoCreateMeeting: z.boolean().optional(),
  })
  .refine((d) => d.startTime < d.endTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

export const recurringClassSchema = z
  .object({
    title: z.string().min(2),
    module: objectId,
    batch: objectId,
    trainer: objectId.optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1), // 0=Sun..6=Sat
    startTime: timeStr,
    endTime: timeStr,
    provider: z.nativeEnum(MeetingProvider).optional(),
    meetingLink: z.string().url().optional().or(z.literal('')),
    autoCreateMeeting: z.boolean().optional(),
  })
  .refine((d) => d.startTime < d.endTime, { message: 'End time must be after start time', path: ['endTime'] })
  .refine((d) => d.endDate >= d.startDate, { message: 'End date must be on or after start date', path: ['endDate'] });

export const updateClassSchema = z.object({
  title: z.string().min(2).optional(),
  date: z.coerce.date().optional(),
  startTime: timeStr.optional(),
  endTime: timeStr.optional(),
  provider: z.nativeEnum(MeetingProvider).optional(),
  meetingLink: z.string().url().optional().or(z.literal('')),
  recordingLink: z.string().url().optional().or(z.literal('')),
  status: z.nativeEnum(ClassStatus).optional(),
});

const POP = [
  { path: 'module', select: 'name code' },
  { path: 'batch', select: 'name code' },
  { path: 'trainer', select: 'name email' },
];

/** Admin always; otherwise the trainer who owns the class. */
async function loadClassForManage(req) {
  const cls = await ClassSchedule.findById(req.params.id);
  if (!cls) throw ApiError.notFound('Class not found');
  if (req.auth.role !== UserRole.ADMIN && cls.trainer.toString() !== req.auth.userId) {
    throw ApiError.forbidden('You can only manage classes you teach');
  }
  return cls;
}

// ── Reading ──────────────────────────────────────────────────────────────────

export async function listClasses(req, res) {
  const { role, userId } = req.auth;
  const q = req.query;
  const filter = {};

  if (q.batch) filter.batch = q.batch;
  if (q.module) filter.module = q.module;
  if (q.status) filter.status = q.status;
  if (q.from || q.to) {
    filter.date = {};
    if (q.from) filter.date.$gte = q.from;
    if (q.to) filter.date.$lte = q.to;
  }

  if (role === UserRole.TRAINER) {
    const me = await User.findById(userId).select('assignedBatches');
    filter.$or = [{ trainer: userId }, { batch: { $in: me?.assignedBatches ?? [] } }];
  } else if (role === UserRole.STUDENT) {
    const me = await User.findById(userId).select('batch');
    if (!me?.batch) return ok(res, []);
    filter.batch = me.batch;
  } else if (q.trainer) {
    filter.trainer = q.trainer;
  }

  const classes = await ClassSchedule.find(filter)
    .sort({ date: 1, startTime: 1 })
    .populate(POP);
  ok(res, classes.map((c) => c.toJSON()));
}

export async function getClass(req, res) {
  const cls = await ClassSchedule.findById(req.params.id).populate(POP);
  if (!cls) throw ApiError.notFound('Class not found');
  ok(res, cls.toJSON());
}

/**
 * Student clicked "Join" — record their entry time. Only the FIRST click sticks
 * ($setOnInsert), so later clicks don't overwrite it. Returns the meeting link.
 */
export async function joinClass(req, res) {
  const cls = await ClassSchedule.findById(req.params.id);
  if (!cls) throw ApiError.notFound('Class not found');

  const batch = await Batch.findById(cls.batch).select('students');
  if (!batch?.students.some((s) => s.toString() === req.auth.userId)) {
    throw ApiError.forbidden('You are not enrolled in this class');
  }

  await ClassJoin.updateOne(
    { classSession: cls._id, student: req.auth.userId },
    { $setOnInsert: { joinedAt: new Date() } },
    { upsert: true },
  );
  const join = await ClassJoin.findOne({ classSession: cls._id, student: req.auth.userId });
  ok(res, { joinedAt: join?.joinedAt ?? null, meetingLink: cls.meetingLink });
}

// ── Create (admin or assigned trainer) ────────────────────────────────────────

/** Resolve + authorize the batch/module/trainer for a (recurring) class create. */
async function resolveClassRefs(req, body) {
  const { role, userId } = req.auth;
  if (role === UserRole.TRAINER) body.trainer = userId;
  else if (!body.trainer) throw ApiError.badRequest('trainer is required');

  const [batch, module, trainer] = await Promise.all([
    Batch.findById(body.batch),
    Module.findById(body.module),
    User.findById(body.trainer),
  ]);
  if (!batch) throw ApiError.badRequest('Batch not found');
  if (!module) throw ApiError.badRequest('Module not found');
  if (!trainer || trainer.role !== UserRole.TRAINER) throw ApiError.badRequest('Assigned trainer is not a trainer');
  if (role === UserRole.TRAINER && !batch.trainers.some((t) => t.toString() === userId)) {
    throw ApiError.forbidden('You are not assigned to this batch');
  }
  return { batch, module, trainer };
}

const MAX_RECURRING = 60;

/** Bulk-create a weekly recurring class series across a date range. */
export async function createRecurringClasses(req, res) {
  const body = { ...req.body };
  await resolveClassRefs(req, body);

  const days = new Set(body.daysOfWeek);
  const start = new Date(Date.UTC(body.startDate.getUTCFullYear(), body.startDate.getUTCMonth(), body.startDate.getUTCDate()));
  const end = new Date(Date.UTC(body.endDate.getUTCFullYear(), body.endDate.getUTCMonth(), body.endDate.getUTCDate()));

  const dates = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (days.has(d.getUTCDay())) dates.push(new Date(d));
    if (dates.length > MAX_RECURRING) {
      throw ApiError.badRequest(`Too many occurrences (max ${MAX_RECURRING}). Narrow the range or days.`);
    }
  }
  if (dates.length === 0) throw ApiError.badRequest('No matching dates in that range');

  const [sh, sm] = body.startTime.split(':').map(Number);
  const [eh, em] = body.endTime.split(':').map(Number);
  const durationMin = eh * 60 + em - (sh * 60 + sm);
  const shareLink = body.meetingLink && body.meetingLink !== '' ? body.meetingLink : undefined;

  const docs = [];
  for (const date of dates) {
    let meetingLink = shareLink;
    if (body.autoCreateMeeting && body.provider === MeetingProvider.ZOOM && !meetingLink) {
      const ymd = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
      try {
        const mtg = await createZoomMeeting({ topic: body.title, startISO: `${ymd}T${body.startTime}:00`, durationMin });
        meetingLink = mtg.joinUrl;
      } catch (err) {
        throw ApiError.badRequest(`Could not create Zoom meeting: ${err.message}`);
      }
    }
    docs.push({
      title: body.title,
      module: body.module,
      batch: body.batch,
      trainer: body.trainer,
      date,
      startTime: body.startTime,
      endTime: body.endTime,
      provider: body.provider,
      meetingLink,
    });
  }

  const created = await ClassSchedule.insertMany(docs);
  ok(res, { created: created.length, classIds: created.map((c) => c._id.toString()) }, 201);
}

export async function createClass(req, res) {
  const { role, userId } = req.auth;
  const body = { ...req.body };

  // Resolve the trainer: a trainer may only schedule classes they teach.
  if (role === UserRole.TRAINER) {
    body.trainer = userId;
  } else if (!body.trainer) {
    throw ApiError.badRequest('trainer is required');
  }

  const [batch, module, trainer] = await Promise.all([
    Batch.findById(body.batch),
    Module.findById(body.module),
    User.findById(body.trainer),
  ]);
  if (!batch) throw ApiError.badRequest('Batch not found');
  if (!module) throw ApiError.badRequest('Module not found');
  if (!trainer || trainer.role !== UserRole.TRAINER) {
    throw ApiError.badRequest('Assigned trainer is not a trainer');
  }

  // A trainer must be assigned to the batch they schedule for.
  if (role === UserRole.TRAINER) {
    const assigned = batch.trainers.some((t) => t.toString() === userId);
    if (!assigned) throw ApiError.forbidden('You are not assigned to this batch');
  }

  if (body.meetingLink === '') delete body.meetingLink;

  // Auto-create a Zoom meeting when asked (and no manual link was provided).
  if (body.autoCreateMeeting && body.provider === MeetingProvider.ZOOM && !body.meetingLink) {
    const d = body.date; // a Date coerced from YYYY-MM-DD (midnight UTC)
    const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const [sh, sm] = body.startTime.split(':').map(Number);
    const [eh, em] = body.endTime.split(':').map(Number);
    try {
      const meeting = await createZoomMeeting({
        topic: body.title,
        startISO: `${ymd}T${body.startTime}:00`,
        durationMin: eh * 60 + em - (sh * 60 + sm),
      });
      body.meetingLink = meeting.joinUrl;
    } catch (err) {
      throw ApiError.badRequest(`Could not create Zoom meeting: ${err.message}`);
    }
  }
  delete body.autoCreateMeeting;

  const cls = await ClassSchedule.create(body);
  const populated = await ClassSchedule.findById(cls._id).populate(POP);
  ok(res, populated.toJSON(), 201);
}

// ── Update / lifecycle (admin or owning trainer) ──────────────────────────────

export async function updateClass(req, res) {
  const cls = await loadClassForManage(req);
  const updates = { ...req.body };
  // Empty strings clear optional links.
  for (const k of ['meetingLink', 'recordingLink']) {
    if (updates[k] === '') {
      cls[k] = undefined;
      delete updates[k];
    }
  }
  if (updates.startTime || updates.endTime) {
    const start = updates.startTime ?? cls.startTime;
    const end = updates.endTime ?? cls.endTime;
    if (start >= end) throw ApiError.badRequest('End time must be after start time');
  }
  Object.assign(cls, updates);
  await cls.save();
  const populated = await ClassSchedule.findById(cls._id).populate(POP);
  ok(res, populated.toJSON());
}

/** Hard delete (admin only) — used for mistaken entries; trainers cancel instead. */
export async function deleteClass(req, res) {
  const cls = await ClassSchedule.findByIdAndDelete(req.params.id);
  if (!cls) throw ApiError.notFound('Class not found');
  ok(res, { id: req.params.id, deleted: true });
}
