import { adminOverview, studentOverview, trainerOverview } from '../services/analytics.js';
import { ok } from '../utils/http.js';

export async function getAdminAnalytics(_req, res) {
  ok(res, await adminOverview());
}

export async function getTrainerAnalytics(req, res) {
  ok(res, await trainerOverview(req.auth.userId));
}

export async function getStudentAnalytics(req, res) {
  ok(res, await studentOverview(req.auth.userId));
}
