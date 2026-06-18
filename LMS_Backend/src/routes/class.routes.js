import { Router } from 'express';
import { UserRole } from '#shared';
import * as classes from '../controllers/class.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
router.use(authenticate);

const adminOnly = requireRole(UserRole.ADMIN);
const adminOrTrainer = requireRole(UserRole.ADMIN, UserRole.TRAINER);

router.get('/', validate({ query: classes.listClassesQuery }), asyncHandler(classes.listClasses));
// Student's pending class ratings (must be before the /:id route).
router.get('/ratings/pending', requireRole(UserRole.STUDENT), asyncHandler(classes.pendingRatings));
router.get('/:id', validate({ params: classes.classIdParam }), asyncHandler(classes.getClass));

// Student records their entry time when joining the video (first click sticks).
router.post(
  '/:id/join',
  requireRole(UserRole.STUDENT),
  validate({ params: classes.classIdParam }),
  asyncHandler(classes.joinClass),
);

// Student rates the class/trainer after attending (≥¾ — enforced client-side
// via entry time; server requires they joined and haven't already rated).
router.post(
  '/:id/rating',
  requireRole(UserRole.STUDENT),
  validate({ params: classes.classIdParam, body: classes.rateClassSchema }),
  asyncHandler(classes.rateClass),
);

router.post(
  '/',
  adminOrTrainer,
  validate({ body: classes.createClassSchema }),
  asyncHandler(classes.createClass),
);
router.post(
  '/recurring',
  adminOrTrainer,
  validate({ body: classes.recurringClassSchema }),
  asyncHandler(classes.createRecurringClasses),
);
router.patch(
  '/:id',
  adminOrTrainer,
  validate({ params: classes.classIdParam, body: classes.updateClassSchema }),
  asyncHandler(classes.updateClass),
);
router.delete(
  '/:id',
  adminOnly,
  validate({ params: classes.classIdParam }),
  asyncHandler(classes.deleteClass),
);

export default router;
