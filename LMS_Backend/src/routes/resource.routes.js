import { Router } from 'express';
import { UserRole } from '#shared';
import * as resources from '../controllers/resource.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
router.use(authenticate);

const adminOrTrainer = requireRole(UserRole.ADMIN, UserRole.TRAINER);

router.get('/', validate({ query: resources.moduleQuery }), asyncHandler(resources.listResources));

// Multer runs first to parse multipart (file + fields), then the handler validates.
router.post('/', adminOrTrainer, resources.uploadResourceFile, asyncHandler(resources.addResource));

// Edit an article's title/content.
router.patch(
  '/:id',
  adminOrTrainer,
  validate({ params: resources.resourceIdParam, body: resources.updateResourceSchema }),
  asyncHandler(resources.updateResource),
);

router.delete(
  '/:id',
  adminOrTrainer,
  validate({ params: resources.resourceIdParam }),
  asyncHandler(resources.deleteResource),
);

export default router;
