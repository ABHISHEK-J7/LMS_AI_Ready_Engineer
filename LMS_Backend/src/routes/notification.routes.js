import { Router } from 'express';
import * as notifications from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
router.use(authenticate); // every signed-in user has their own feed

router.get('/', asyncHandler(notifications.listMine));
router.get('/unread-count', asyncHandler(notifications.unreadCount));
router.post('/read', asyncHandler(notifications.markAllRead));
router.post('/:id/read', validate({ params: notifications.notificationIdParam }), asyncHandler(notifications.markRead));

export default router;
