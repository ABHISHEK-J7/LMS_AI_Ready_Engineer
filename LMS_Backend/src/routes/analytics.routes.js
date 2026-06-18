import { Router } from 'express';
import { UserRole } from '#shared';
import * as analytics from '../controllers/analytics.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
router.use(authenticate);

router.get('/admin', requireRole(UserRole.ADMIN), asyncHandler(analytics.getAdminAnalytics));
router.get('/trainer', requireRole(UserRole.TRAINER, UserRole.ADMIN), asyncHandler(analytics.getTrainerAnalytics));

export default router;
