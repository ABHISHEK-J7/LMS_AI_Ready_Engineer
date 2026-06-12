import { Router } from 'express';
import { UserRole } from '@lms/shared';
import * as ann from '../controllers/announcement.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(ann.listAnnouncements));
router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.TRAINER),
  validate({ body: ann.createAnnouncementSchema }),
  asyncHandler(ann.createAnnouncement),
);
router.delete(
  '/:id',
  requireRole(UserRole.ADMIN, UserRole.TRAINER),
  validate({ params: ann.announcementIdParam }),
  asyncHandler(ann.deleteAnnouncement),
);

export default router;
