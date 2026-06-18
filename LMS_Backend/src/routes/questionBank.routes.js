import { Router } from 'express';
import { UserRole } from '#shared';
import * as qb from '../controllers/questionBank.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
router.use(authenticate);

// The question bank is staff-only — students never read or write it.
const adminOrTrainer = requireRole(UserRole.ADMIN, UserRole.TRAINER);
router.use(adminOrTrainer);

router.get('/', validate({ query: qb.listBankQuery }), asyncHandler(qb.listBankItems));
router.post('/', validate({ body: qb.createBankItemSchema }), asyncHandler(qb.createBankItem));
router.post('/bulk', validate({ body: qb.bulkBankSchema }), asyncHandler(qb.bulkAddBankItems));
router.patch('/:itemId', validate({ params: qb.bankItemParam, body: qb.updateBankItemSchema }), asyncHandler(qb.updateBankItem));
router.delete('/:itemId', validate({ params: qb.bankItemParam }), asyncHandler(qb.deleteBankItem));

export default router;
