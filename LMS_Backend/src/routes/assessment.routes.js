import { Router } from 'express';
import { UserRole } from '#shared';
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

// Build a test by hand-picking from the module's question bank (bank-only authoring).
router.post('/:id/questions/from-bank', adminOrTrainer, validate({ params: a.assessmentIdParam, body: a.fromBankSchema }), asyncHandler(a.addQuestionsFromBank));
router.delete('/:id/questions/:questionId', adminOrTrainer, validate({ params: a.questionParam }), asyncHandler(a.deleteQuestion));

// Timed/proctored attempts.
router.post('/:id/start', studentOnly, validate({ params: sub.assessmentIdParam }), asyncHandler(sub.startAttempt));
router.patch('/:id/progress', studentOnly, validate({ params: sub.assessmentIdParam, body: sub.progressSchema }), asyncHandler(sub.saveProgress));
router.post('/:id/disqualify', studentOnly, validate({ params: sub.assessmentIdParam, body: sub.disqualifySchema }), asyncHandler(sub.disqualifyAttempt));
router.post('/:id/proctor-shot', studentOnly, validate({ params: sub.assessmentIdParam }), sub.uploadProctorShot, asyncHandler(sub.proctorShot));
router.post('/:id/warning', studentOnly, validate({ params: sub.assessmentIdParam, body: sub.warningSchema }), asyncHandler(sub.recordWarning));

// Submissions.
router.post('/:id/submit', studentOnly, validate({ params: sub.assessmentIdParam, body: sub.submitSchema }), asyncHandler(sub.submit));
router.get('/:id/submission', studentOnly, validate({ params: sub.assessmentIdParam }), asyncHandler(sub.getMySubmission));
router.get('/:id/submissions', adminOrTrainer, validate({ params: sub.assessmentIdParam }), asyncHandler(sub.listSubmissions));
router.get('/:id/submissions.csv', adminOrTrainer, validate({ params: sub.assessmentIdParam }), asyncHandler(sub.exportSubmissionsCsv));
router.get('/:id/leaderboard', validate({ params: sub.assessmentIdParam }), asyncHandler(sub.leaderboard));
router.post('/:id/submissions/:submissionId/regrade', adminOrTrainer, validate({ params: sub.submissionParam }), asyncHandler(sub.regradeSubmission));

export default router;
