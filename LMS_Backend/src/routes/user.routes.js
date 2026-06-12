import { Router } from 'express';
import { UserRole } from '@lms/shared';
import * as users from '../controllers/user.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

// All user-management endpoints are admin-only.
router.use(authenticate, requireRole(UserRole.ADMIN));

router.get('/', validate({ query: users.listUsersQuery }), asyncHandler(users.listUsers));
router.post('/', validate({ body: users.createUserSchema }), asyncHandler(users.createUser));
router.post('/bulk', validate({ body: users.bulkCreateSchema }), asyncHandler(users.bulkCreateUsers));
router.get('/:id', validate({ params: users.userIdParam }), asyncHandler(users.getUser));
router.patch(
  '/:id',
  validate({ params: users.userIdParam, body: users.updateUserSchema }),
  asyncHandler(users.updateUser),
);
router.post(
  '/:id/approve',
  validate({ params: users.userIdParam }),
  asyncHandler(users.approveUser),
);
router.delete('/:id', validate({ params: users.userIdParam }), asyncHandler(users.archiveUser));

export default router;
