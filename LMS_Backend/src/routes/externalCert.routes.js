import { Router } from 'express';
import { UserRole } from '@lms/shared';
import * as ext from '../controllers/externalCert.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
router.use(authenticate, requireRole(UserRole.STUDENT));

router.get('/', asyncHandler(ext.listMine));
// Multer parses multipart (file + fields) first, then the handler validates.
router.post('/', ext.uploadCertFile, asyncHandler(ext.create));
router.delete('/:id', validate({ params: ext.externalCertIdParam }), asyncHandler(ext.remove));

export default router;
