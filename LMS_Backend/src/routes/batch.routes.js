import { Router } from 'express';
import { UserRole } from '#shared';
import * as batches from '../controllers/batch.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
router.use(authenticate);

const adminOnly = requireRole(UserRole.ADMIN);
const adminOrTrainer = requireRole(UserRole.ADMIN, UserRole.TRAINER);

// Reading (role-filtered in the controller).
router.get('/', asyncHandler(batches.listBatches));
router.get('/:id', validate({ params: batches.batchIdParam }), asyncHandler(batches.getBatch));

// Admin CRUD.
router.post('/', adminOnly, validate({ body: batches.createBatchSchema }), asyncHandler(batches.createBatch));
router.patch(
  '/:id',
  adminOnly,
  validate({ params: batches.batchIdParam, body: batches.updateBatchSchema }),
  asyncHandler(batches.updateBatch),
);
router.delete('/:id', adminOnly, validate({ params: batches.batchIdParam }), asyncHandler(batches.archiveBatch));

// Membership (admin).
router.post(
  '/:id/students',
  adminOnly,
  validate({ params: batches.batchIdParam, body: batches.idsSchema }),
  asyncHandler(batches.assignStudents),
);
router.delete(
  '/:id/students/:memberId',
  adminOnly,
  validate({ params: batches.batchMemberParam }),
  asyncHandler(batches.removeStudent),
);
router.post(
  '/:id/trainers',
  adminOnly,
  validate({ params: batches.batchIdParam, body: batches.idsSchema }),
  asyncHandler(batches.assignTrainers),
);
router.delete(
  '/:id/trainers/:memberId',
  adminOnly,
  validate({ params: batches.batchMemberParam }),
  asyncHandler(batches.removeTrainer),
);
router.post(
  '/:id/modules',
  adminOnly,
  validate({ params: batches.batchIdParam, body: batches.idsSchema }),
  asyncHandler(batches.assignModules),
);
router.delete(
  '/:id/modules/:memberId',
  adminOnly,
  validate({ params: batches.batchMemberParam }),
  asyncHandler(batches.removeModule),
);

// Per-module trainer mapping (who delivers each module in this batch).
router.put(
  '/:id/modules/:moduleId/trainers',
  adminOnly,
  validate({ params: batches.batchModuleParam, body: batches.moduleTrainersSchema }),
  asyncHandler(batches.setModuleTrainers),
);

// Mark a syllabus topic taught/untaught for a module in this batch (admin or the
// batch's assigned trainer — enforced in the handler).
router.put(
  '/:id/modules/:moduleId/topics/:topicId',
  adminOrTrainer,
  validate({ params: batches.batchTopicParam, body: batches.topicTaughtSchema }),
  asyncHandler(batches.setTopicTaught),
);

export default router;
