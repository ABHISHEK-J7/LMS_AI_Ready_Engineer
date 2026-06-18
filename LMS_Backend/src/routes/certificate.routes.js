import { Router } from 'express';
import { UserRole } from '#shared';
import * as certs from '../controllers/certificate.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

// PUBLIC verification (no auth) — declared before the authenticate guard.
router.get(
  '/verify/:certificateId',
  validate({ params: certs.certIdParam }),
  asyncHandler(certs.verifyCertificate),
);

router.use(authenticate);

router.get('/me', requireRole(UserRole.STUDENT), asyncHandler(certs.myCertificates));
router.get('/', requireRole(UserRole.ADMIN), asyncHandler(certs.listAllCertificates));
router.get(
  '/student/:studentId',
  requireRole(UserRole.ADMIN, UserRole.TRAINER),
  validate({ params: certs.studentIdParam }),
  asyncHandler(certs.studentCertificates),
);

export default router;
