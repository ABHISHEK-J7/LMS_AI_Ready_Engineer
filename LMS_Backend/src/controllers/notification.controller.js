import { z } from 'zod';
import { Notification } from '../models/index.js';
import { runUnscoped } from '../services/tenantContext.js';
import { ok } from '../utils/http.js';

export const notificationIdParam = z.object({ id: z.string().length(24) });

// Notifications are keyed by `user`, which is already a hard ownership filter — a user
// only ever sees their own. We run these unscoped so the org context (incl. a super
// admin's X-Org-Id drill-in header) can't hide a user's own notifications from them,
// e.g. a super admin's GLOBAL, org-less syllabus-request alerts.

/** The signed-in user's notifications, newest first. */
export async function listMine(req, res) {
  const items = await runUnscoped(() =>
    Notification.find({ user: req.auth.userId }).sort({ createdAt: -1 }).limit(50));
  ok(res, items.map((n) => n.toJSON()));
}

/** Count of unread notifications (drives the bell badge). */
export async function unreadCount(req, res) {
  const count = await runUnscoped(() =>
    Notification.countDocuments({ user: req.auth.userId, read: false }));
  ok(res, { count });
}

/** Mark all of the user's notifications read. */
export async function markAllRead(req, res) {
  await runUnscoped(() =>
    Notification.updateMany({ user: req.auth.userId, read: false }, { $set: { read: true } }));
  ok(res, { ok: true });
}

/** Mark one notification read (must be the user's own). */
export async function markRead(req, res) {
  await runUnscoped(() =>
    Notification.updateOne({ _id: req.params.id, user: req.auth.userId }, { $set: { read: true } }));
  ok(res, { ok: true });
}
