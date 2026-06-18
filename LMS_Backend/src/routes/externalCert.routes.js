import { Router } from 'express';
import { UserRole } from '#shared';
import * as ext from '../controllers/externalCert.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
router.use(authenticate);

const studentOnly = requireRole(UserRole.STUDENT);
const reviewer = requireRole(UserRole.ADMIN, UserRole.TRAINER);

// Reviewer (trainer/admin) — list submissions to verify + approve/reject.
router.get('/review', reviewer, asyncHandler(ext.listForReview));
router.patch('/:id/review', reviewer, validate({ params: ext.externalCertIdParam, body: ext.reviewSchema }), asyncHandler(ext.review));

// Student — their own uploads.
router.get('/', studentOnly, asyncHandler(ext.listMine));
// Multer parses multipart (file + fields) first, then the handler validates.
router.post('/', studentOnly, ext.uploadCertFile, asyncHandler(ext.create));
router.delete('/:id', studentOnly, validate({ params: ext.externalCertIdParam }), asyncHandler(ext.remove));

export default router;
