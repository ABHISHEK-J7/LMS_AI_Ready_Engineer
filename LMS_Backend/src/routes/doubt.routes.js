import { Router } from 'express';
import { UserRole } from '@lms/shared';
import * as doubts from '../controllers/doubt.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
router.use(authenticate);

router.get('/', validate({ query: doubts.listDoubtsQuery }), asyncHandler(doubts.listDoubts));
router.post('/', requireRole(UserRole.STUDENT), validate({ body: doubts.createDoubtSchema }), asyncHandler(doubts.createDoubt));
router.get('/:id', validate({ params: doubts.doubtIdParam }), asyncHandler(doubts.getDoubt));
router.post('/:id/replies', validate({ params: doubts.doubtIdParam, body: doubts.replySchema }), asyncHandler(doubts.addReply));
router.patch(
  '/:id/status',
  requireRole(UserRole.ADMIN, UserRole.TRAINER),
  validate({ params: doubts.doubtIdParam, body: doubts.statusSchema }),
  asyncHandler(doubts.setStatus),
);

export default router;
