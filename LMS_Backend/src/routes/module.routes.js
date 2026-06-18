import { Router } from 'express';
import { UserRole } from '#shared';
import * as modules from '../controllers/module.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

router.use(authenticate);

const adminOnly = requireRole(UserRole.ADMIN);
const adminOrTrainer = requireRole(UserRole.ADMIN, UserRole.TRAINER);

// ── Reading (all roles; controller filters by role) ──────────────────────────
router.get('/', asyncHandler(modules.listModules));

// Admin bulk reorder (declared before "/:id" routes — distinct method/path anyway).
router.post(
  '/reorder',
  adminOnly,
  validate({ body: modules.reorderSchema }),
  asyncHandler(modules.reorderModules),
);

router.get('/:id', validate({ params: modules.moduleIdParam }), asyncHandler(modules.getModule));

// ── Admin CRUD ────────────────────────────────────────────────────────────────
router.post('/', adminOnly, validate({ body: modules.createModuleSchema }), asyncHandler(modules.createModule));
router.patch(
  '/:id',
  adminOnly,
  validate({ params: modules.moduleIdParam, body: modules.updateModuleSchema }),
  asyncHandler(modules.updateModule),
);
router.delete(
  '/:id',
  adminOnly,
  validate({ params: modules.moduleIdParam }),
  asyncHandler(modules.archiveModule),
);

// ── Trainer assignment (admin) ────────────────────────────────────────────────
router.post(
  '/:id/trainers',
  adminOnly,
  validate({ params: modules.moduleIdParam, body: modules.assignTrainerSchema }),
  asyncHandler(modules.assignTrainer),
);
router.delete(
  '/:id/trainers/:trainerId',
  adminOnly,
  validate({ params: modules.trainerParam }),
  asyncHandler(modules.removeTrainer),
);

// ── Syllabus: topics & objectives (admin OR the assigned trainer) ─────────────
router.post(
  '/:id/topics',
  adminOrTrainer,
  validate({ params: modules.moduleIdParam, body: modules.topicSchema }),
  asyncHandler(modules.addTopic),
);
router.patch(
  '/:id/topics/:topicId',
  adminOrTrainer,
  validate({ params: modules.topicParam, body: modules.updateTopicSchema }),
  asyncHandler(modules.updateTopic),
);
router.delete(
  '/:id/topics/:topicId',
  adminOrTrainer,
  validate({ params: modules.topicParam }),
  asyncHandler(modules.deleteTopic),
);
router.patch(
  '/:id/topics/:topicId/completion',
  adminOrTrainer,
  validate({ params: modules.topicParam, body: modules.updateTopicSchema }),
  asyncHandler(modules.setTopicCompletion),
);
router.patch(
  '/:id/objectives',
  adminOrTrainer,
  validate({ params: modules.moduleIdParam, body: modules.objectivesSchema }),
  asyncHandler(modules.updateObjectives),
);

export default router;
