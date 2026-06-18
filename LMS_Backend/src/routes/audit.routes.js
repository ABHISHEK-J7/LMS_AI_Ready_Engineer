import { Router } from 'express';
import { UserRole } from '#shared';
import * as audit from '../controllers/audit.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
router.use(authenticate, requireRole(UserRole.ADMIN));

router.get('/', validate({ query: audit.listAuditQuery }), asyncHandler(audit.listAudit));

export default router;
