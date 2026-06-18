import { Notification } from '../models/index.js';

/**
 * Create in-app notifications. Best-effort: a notification failure must never
 * break the action that triggered it, so callers can fire-and-forget.
 */
export async function notify(userId, { type = 'info', title, body = '', link = '' }) {
  if (!userId || !title) return;
  try {
    await Notification.create({ user: userId, type, title, body, link });
  } catch {
    /* non-fatal */
  }
}

export async function notifyMany(userIds, { type = 'info', title, body = '', link = '' }) {
  const ids = [...new Set((userIds ?? []).map((u) => String(u)).filter(Boolean))];
  if (!ids.length || !title) return;
  try {
    await Notification.insertMany(ids.map((u) => ({ user: u, type, title, body, link })));
  } catch {
    /* non-fatal */
  }
}
