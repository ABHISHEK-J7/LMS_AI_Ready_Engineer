import { z } from 'zod';
import { UserRole } from '#shared';
import { User } from '../models/index.js';
import { computeProgress } from '../services/progression.js';
import { ApiError } from '../utils/ApiError.js';
import { assertCanViewStudent } from '../utils/access.js';
import { ok } from '../utils/http.js';

export const studentIdParam = z.object({ studentId: z.string().length(24) });

/** The signed-in student's curriculum progression. */
export async function myProgress(req, res) {
  ok(res, await computeProgress(req.auth.userId));
}

/** Admin/trainer: a specific student's progression. */
export async function studentProgress(req, res) {
  await assertCanViewStudent(req, req.params.studentId);
  const student = await User.findById(req.params.studentId).select('name email role');
  if (!student || student.role !== UserRole.STUDENT) throw ApiError.notFound('Student not found');
  ok(res, { student: student.toJSON(), ...(await computeProgress(req.params.studentId)) });
}
