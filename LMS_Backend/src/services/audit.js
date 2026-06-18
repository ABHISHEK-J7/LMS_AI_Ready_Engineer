import { AuditLog } from '../models/index.js';

/**
 * Record a sensitive action. Best-effort: never block or fail the action it
 * audits. Reads actor identity from req.auth (set by the auth middleware).
 */
export async function audit(req, action, { targetType = '', targetId = '', meta } = {}) {
  try {
    await AuditLog.create({
      actor: req?.auth?.userId,
      actorName: req?.auth?.name ?? '',
      actorRole: req?.auth?.role ?? '',
      action,
      targetType,
      targetId: targetId ? String(targetId) : '',
      meta,
      ip: req?.ip ?? '',
    });
  } catch {
    /* non-fatal */
  }
}
