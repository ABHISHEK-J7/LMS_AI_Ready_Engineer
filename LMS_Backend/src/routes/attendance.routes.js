import { Router } from 'express';
import { UserRole } from '#shared';
import * as attendance from '../controllers/attendance.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
router.use(authenticate);

const adminOrTrainer = requireRole(UserRole.ADMIN, UserRole.TRAINER);

// Student's own attendance (summary + history).
router.get('/me', requireRole(UserRole.STUDENT), asyncHandler(attendance.myAttendance));

// Entry screen: roster + bulk save (admin or the owning trainer — enforced in controller).
router.get(
  '/class/:classId',
  adminOrTrainer,
  validate({ params: attendance.classIdParam }),
  asyncHandler(attendance.getClassRoster),
);
router.post(
  '/class/:classId',
  adminOrTrainer,
  validate({ params: attendance.classIdParam, body: attendance.saveAttendanceSchema }),
  asyncHandler(attendance.saveAttendance),
);

// Reporting.
router.get(
  '/student/:studentId',
  adminOrTrainer,
  validate({ params: attendance.studentIdParam }),
  asyncHandler(attendance.getStudentAttendance),
);
router.get(
  '/batch/:batchId',
  adminOrTrainer,
  validate({ params: attendance.batchIdParam }),
  asyncHandler(attendance.getBatchAttendance),
);
router.get(
  '/batch/:batchId/export.csv',
  adminOrTrainer,
  validate({ params: attendance.batchIdParam }),
  asyncHandler(attendance.exportBatchAttendanceCsv),
);

export default router;
