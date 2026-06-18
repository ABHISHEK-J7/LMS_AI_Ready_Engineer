import { z } from 'zod';
import { AuditLog } from '../models/index.js';
import { ok } from '../utils/http.js';

export const listAuditQuery = z.object({
  action: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

/** Admin: recent audit-log entries (optionally filtered by action). */
export async function listAudit(req, res) {
  const filter = {};
  if (req.query.action) filter.action = req.query.action;
  const entries = await AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(req.query.limit ?? 200)
    .populate('actor', 'name email role');
  ok(res, entries.map((e) => e.toJSON()));
}
