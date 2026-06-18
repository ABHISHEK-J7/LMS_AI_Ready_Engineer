import { UserRole } from '#shared';
import { Batch } from '../models/index.js';
import { ApiError } from './ApiError.js';

/**
 * Authorization scoping for staff viewing student-owned data. Admins see
 * everything; a trainer may only see students/batches they are assigned to.
 */

/** Trainers may only view students in batches they're assigned to. */
export async function assertCanViewStudent(req, studentId) {
  if (req.auth.role === UserRole.ADMIN) return;
  const batches = await Batch.find({ trainers: req.auth.userId }).select('students');
  const ok = batches.some((b) => b.students.some((s) => s.toString() === String(studentId)));
  if (!ok) throw ApiError.forbidden('This student is not in your batches');
}

/** Trainers may only view a batch they're assigned to. */
export async function assertCanViewBatch(req, batchId) {
  if (req.auth.role === UserRole.ADMIN) return;
  const batch = await Batch.findById(batchId).select('trainers');
  const ok = batch?.trainers?.some((t) => t.toString() === req.auth.userId);
  if (!ok) throw ApiError.forbidden('This batch is not assigned to you');
}
