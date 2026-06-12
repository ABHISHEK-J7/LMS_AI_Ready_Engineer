import { z } from 'zod';
import { UserRole, UserStatus } from '@lms/shared';
import { Batch, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';

export const listUsersQuery = z.object({
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  // Up to 500 so "assign" pickers (trainers/students directory) can load the
  // full list in one request, not just a paginated page.
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
});

export const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  password: z.string().min(8).max(128),
  role: z.nativeEnum(UserRole),
  phone: z.string().max(40).optional(),
});

/** Bulk import (from an Excel/CSV upload). Passwords are NOT set here — imported
 *  users onboard via the email-OTP flow. `batchId` (optional) enrolls created
 *  + matched students into that batch. */
export const bulkCreateSchema = z.object({
  role: z.nativeEnum(UserRole).optional(), // defaults to student
  batchId: z.string().length(24).optional(),
  users: z
    .array(
      z.object({
        firstName: z.string().trim().max(80).optional(),
        lastName: z.string().trim().max(80).optional(),
        name: z.string().trim().max(120).optional(),
        email: z.string().trim().toLowerCase().email().max(160),
        phone: z.string().trim().max(40).optional(),
      }),
    )
    .min(1, 'No rows to import')
    .max(2000, 'Import at most 2000 rows at a time'),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(40).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  avatarUrl: z.string().url().max(500).optional(),
});

/** Escape regex metacharacters so user search can't inject patterns / cause ReDoS. */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const idParam = z.object({ id: z.string().length(24) });
export { idParam as userIdParam };

/** Admin: paginated, filterable user directory. */
export async function listUsers(req, res) {
  const { role, status, search, page, pageSize } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (search) {
    const safe = escapeRegex(search);
    filter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    User.countDocuments(filter),
  ]);

  const body = {
    items: items.map((u) => u.toJSON()),
    page,
    pageSize,
    total,
  };
  ok(res, body);
}

export async function getUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  ok(res, user.toJSON());
}

/** Admin: onboard a user (student/trainer/admin). */
export async function createUser(req, res) {
  const { name, email, password, role, phone } = req.body;
  if (await User.findOne({ email })) {
    throw ApiError.conflict('An account with that email already exists');
  }
  const passwordHash = await User.setPassword(password);
  const user = await User.create({
    name,
    email,
    passwordHash,
    role,
    phone,
    status: UserStatus.ACTIVE,
  });
  ok(res, user.toJSON(), 201);
}

/**
 * Admin: bulk-import users from a spreadsheet. Each row needs an email; the name
 * is taken from `name` or `firstName`+`lastName`. Imported users have NO
 * password (they onboard via email OTP). Existing emails are skipped (and, when
 * a batch is given, still enrolled). Returns a per-row summary.
 */
export async function bulkCreateUsers(req, res) {
  const role = req.body.role ?? UserRole.STUDENT;
  const { batchId, users } = req.body;

  const batch = batchId ? await Batch.findById(batchId) : null;
  if (batchId && !batch) throw ApiError.notFound('Batch not found');
  if (batch && role !== UserRole.STUDENT) {
    throw ApiError.badRequest('Only students can be enrolled into a batch');
  }

  const created = [];
  const skipped = []; // { email, reason }
  const enrollIds = []; // student ids to add to the batch (created + matched)
  const seen = new Set();

  for (const row of users) {
    const email = row.email; // already lowercased/trimmed by zod
    const name = (row.name || [row.firstName, row.lastName].filter(Boolean).join(' ')).trim();
    if (!name) { skipped.push({ email, reason: 'Missing name' }); continue; }
    if (seen.has(email)) { skipped.push({ email, reason: 'Duplicate row' }); continue; }
    seen.add(email);

    const existing = await User.findOne({ email });
    if (existing) {
      skipped.push({ email, reason: 'Already exists' });
      if (batch && existing.role === UserRole.STUDENT) enrollIds.push(existing.id);
      continue;
    }
    // No passwordHash: user sets it later via the OTP onboarding flow.
    const user = await User.create({ name, email, role, phone: row.phone, status: UserStatus.ACTIVE });
    created.push({ id: user.id, name: user.name, email: user.email });
    if (batch) enrollIds.push(user.id);
  }

  let enrolled = 0;
  if (batch && enrollIds.length) {
    // A student belongs to exactly one batch: detach from any other batch first.
    await Batch.updateMany(
      { _id: { $ne: batch._id }, students: { $in: enrollIds } },
      { $pull: { students: { $in: enrollIds } } },
    );
    await User.updateMany({ _id: { $in: enrollIds } }, { $set: { batch: batch._id } });
    const current = new Set(batch.students.map((s) => s.toString()));
    for (const id of enrollIds) if (!current.has(id)) batch.students.push(id);
    await batch.save();
    enrolled = enrollIds.length;
  }

  ok(res, {
    createdCount: created.length,
    skippedCount: skipped.length,
    enrolledCount: enrolled,
    created,
    skipped,
  }, 201);
}

export async function updateUser(req, res) {
  const updates = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!user) throw ApiError.notFound('User not found');
  ok(res, user.toJSON());
}

/** Admin: approve a pending self-registered student. */
export async function approveUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.status !== UserStatus.PENDING) {
    throw ApiError.badRequest('User is not pending approval');
  }
  user.status = UserStatus.ACTIVE;
  await user.save();
  ok(res, user.toJSON());
}

/** Soft-delete: archive rather than destroy, to preserve attendance/assessment history. */
export async function archiveUser(req, res) {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { status: UserStatus.ARCHIVED },
    { new: true },
  );
  if (!user) throw ApiError.notFound('User not found');
  ok(res, user.toJSON());
}
