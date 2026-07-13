import { Router } from 'express';
import { UserRole } from '#shared';
import * as doubts from '../controllers/doubt.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
router.use(authenticate);

router.get('/', validate({ query: doubts.listDoubtsQuery }), asyncHandler(doubts.listDoubts));
// Trainer scoreboard — doubts answered + average rating received.
router.get('/my-stats', requireRole(UserRole.ADMIN, UserRole.TRAINER), asyncHandler(doubts.myDoubtStats));
router.post('/', requireRole(UserRole.STUDENT), validate({ body: doubts.createDoubtSchema }), asyncHandler(doubts.createDoubt));
router.get('/:id', validate({ params: doubts.doubtIdParam }), asyncHandler(doubts.getDoubt));
router.post('/:id/replies', validate({ params: doubts.doubtIdParam, body: doubts.replySchema }), asyncHandler(doubts.addReply));
// Resolving + rating is STUDENT-only — the trainer just answers.
router.post(
  '/:id/close',
  requireRole(UserRole.STUDENT),
  validate({ params: doubts.doubtIdParam, body: doubts.closeSchema }),
  asyncHandler(doubts.closeDoubt),
);
// Rate at any time (incl. after an auto-close) while the doubt is still unrated.
router.post(
  '/:id/rate',
  requireRole(UserRole.STUDENT),
  validate({ params: doubts.doubtIdParam, body: doubts.rateSchema }),
  asyncHandler(doubts.rateDoubt),
);

export default router;
