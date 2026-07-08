import { Router } from 'express';
import { UserRole } from '#shared';
import * as settings from '../controllers/settings.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

// PUBLIC — used by login/registration before authentication.
router.get('/public', asyncHandler(settings.getPublicSettings));

router.use(authenticate, requireRole(UserRole.ADMIN));
router.get('/', asyncHandler(settings.getAllSettings));
router.patch('/', validate({ body: settings.updateSettingsSchema }), asyncHandler(settings.updateSettings));
router.post('/test-ai', asyncHandler(settings.testAiConnection));
router.post('/test-email', validate({ body: settings.testEmailSchema }), asyncHandler(settings.testEmailConnection));
router.post('/test-zoom', asyncHandler(settings.testZoomConnection));
router.post('/seb-config', settings.uploadSebConfig, asyncHandler(settings.setSebConfig));

export default router;
