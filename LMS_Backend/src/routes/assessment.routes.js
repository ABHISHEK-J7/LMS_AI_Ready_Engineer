import { Router } from 'express';
import { UserRole } from '@lms/shared';
import * as a from '../controllers/assessment.controller.js';
import * as sub from '../controllers/submission.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
router.use(authenticate);

const adminOrTrainer = requireRole(UserRole.ADMIN, UserRole.TRAINER);
const studentOnly = requireRole(UserRole.STUDENT);

// Listing / reading (role-aware in the controller).
router.get('/', validate({ query: a.listAssessmentsQuery }), asyncHandler(a.listAssessments));
router.get('/:id', validate({ params: a.assessmentIdParam }), asyncHandler(a.getAssessment));

// Authoring (admin or assigned trainer).
router.post('/', adminOrTrainer, validate({ body: a.createAssessmentSchema }), asyncHandler(a.createAssessment));
router.patch('/:id', adminOrTrainer, validate({ params: a.assessmentIdParam, body: a.updateAssessmentSchema }), asyncHandler(a.updateAssessment));
router.delete('/:id', adminOrTrainer, validate({ params: a.assessmentIdParam }), asyncHandler(a.deleteAssessment));

// The trainer-controlled gate.
router.post('/:id/unlock', adminOrTrainer, validate({ params: a.assessmentIdParam, body: a.unlockSchema }), asyncHandler(a.unlockAssessment));
router.post('/:id/lock', adminOrTrainer, validate({ params: a.assessmentIdParam }), asyncHandler(a.lockAssessment));

// Question authoring.
router.post('/:id/questions', adminOrTrainer, validate({ params: a.assessmentIdParam, body: a.questionParamBody }), asyncHandler(a.addQuestion));
router.post('/:id/questions/bulk', adminOrTrainer, validate({ params: a.assessmentIdParam, body: a.bulkQuestionsSchema }), asyncHandler(a.addQuestionsBulk));
router.patch('/:id/questions/:questionId', adminOrTrainer, validate({ params: a.questionParam, body: a.questionParamBody }), asyncHandler(a.updateQuestion));
router.delete('/:id/questions/:questionId', adminOrTrainer, validate({ params: a.questionParam }), asyncHandler(a.deleteQuestion));

// Submissions.
router.post('/:id/submit', studentOnly, validate({ params: sub.assessmentIdParam, body: sub.submitSchema }), asyncHandler(sub.submit));
router.get('/:id/submission', studentOnly, validate({ params: sub.assessmentIdParam }), asyncHandler(sub.getMySubmission));
router.get('/:id/submissions', adminOrTrainer, validate({ params: sub.assessmentIdParam }), asyncHandler(sub.listSubmissions));
router.get('/:id/leaderboard', validate({ params: sub.assessmentIdParam }), asyncHandler(sub.leaderboard));
router.post('/:id/submissions/:submissionId/regrade', adminOrTrainer, validate({ params: sub.submissionParam }), asyncHandler(sub.regradeSubmission));

export default router;
