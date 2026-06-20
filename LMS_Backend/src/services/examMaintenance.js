import crypto from 'node:crypto';
import { SubmissionStatus } from '#shared';
import { Assessment, Submission } from '../models/index.js';
import { finalizeIfExpired } from '../controllers/submission.controller.js';
import { env } from '../config/env.js';
import { deleteByUrl } from './fileStore.js';
import { redisEnabled, getRedis } from './redis.js';
import { logger } from '../utils/logger.js';
import { getEvaluator, gradeInBackground } from './aiGrading.js';

// Stable id for this process, used for the single-leader sweeper lock.
const INSTANCE_ID = crypto.randomUUID();
const LEADER_KEY = 'sweep:leader';
const LEADER_TTL_MS = 90_000;

/**
 * Single-leader gate. With Redis (multi-instance), only the lock holder runs the
 * sweep so work isn't duplicated / double-graded across replicas. Without Redis
 * (single instance) this always returns true.
 */
async function isSweepLeader() {
  if (!redisEnabled()) return true;
  try {
    const r = await getRedis();
    if (!r) return true;
    const acquired = await r.set(LEADER_KEY, INSTANCE_ID, 'NX', 'PX', LEADER_TTL_MS);
    if (acquired === 'OK') return true;
    if ((await r.get(LEADER_KEY)) === INSTANCE_ID) {
      await r.pexpire(LEADER_KEY, LEADER_TTL_MS);
      return true;
    }
    return false;
  } catch {
    return false; // if Redis is unreachable, don't risk duplicate sweeps
  }
}

/**
 * Background maintenance for the exam engine. This is an in-process sweeper (no
 * external infra). For a horizontally-scaled / crash-proof deployment, swap this
 * for a durable job queue (e.g. BullMQ + Redis); the two functions below are the
 * exact units of work a queue would run.
 */

const SWEEP_INTERVAL_MS = 60_000;
const STUCK_EVALUATING_MS = 5 * 60_000;
// Retention runs far less often than the per-minute sweep (snapshots age in days).
const RETENTION_INTERVAL_MS = 6 * 60 * 60_000; // every 6 hours
const DAY_MS = 24 * 60 * 60_000;

/** Finalize timed attempts whose clock fully expired (so abandoned attempts get
 *  graded even if nobody opens them). Previously only happened lazily on read. */
export async function sweepExpiredAttempts() {
  const inProgress = await Submission.find({
    status: SubmissionStatus.IN_PROGRESS,
    startedAt: { $ne: null },
  });
  let finalized = 0;
  for (const sub of inProgress) {
    const assessment = await Assessment.findById(sub.assessment);
    if (!assessment) continue;
    const before = sub.status;
    await finalizeIfExpired(assessment, sub); // no-op until past endsAt + grace
    if (sub.status !== before) finalized += 1;
  }
  return finalized;
}

/** Re-drive submissions stuck in EVALUATING (e.g. the process crashed mid-grade). */
export async function redriveStuckGrading() {
  if (!(await getEvaluator())) return 0;
  const cutoff = new Date(Date.now() - STUCK_EVALUATING_MS);
  const stuck = await Submission.find({ status: SubmissionStatus.EVALUATING, updatedAt: { $lt: cutoff } }).select('_id assessment');
  for (const s of stuck) gradeInBackground(s.assessment, s._id);
  return stuck.length;
}

/**
 * GDPR retention: delete webcam proctor snapshots (the files on disk + the DB
 * references) for attempts older than PROCTOR_RETENTION_DAYS. Snapshots are
 * personal data captured only for live invigilation; they should not be kept
 * indefinitely. The graded result (score/passed/warnings) is preserved.
 * Returns the number of submissions cleared.
 */
export async function purgeOldProctorShots() {
  const days = env.proctorRetentionDays;
  if (!days || days <= 0) return 0; // retention disabled
  const cutoff = new Date(Date.now() - days * DAY_MS);
  const stale = await Submission.find({
    'proctorShots.0': { $exists: true }, // non-empty array
    submittedAt: { $lt: cutoff },
  }).select('proctorShots');

  let cleared = 0;
  for (const sub of stale) {
    for (const url of sub.proctorShots) await deleteByUrl(url);
    sub.proctorShots = [];
    await sub.save();
    cleared += 1;
  }
  if (cleared) logger.info('[exam-maintenance] purged proctor snapshots', { submissions: cleared, olderThanDays: days });
  return cleared;
}

/** Start the periodic sweep. Returns the interval handles so they can be cleared. */
export function startExamMaintenance() {
  const run = async () => {
    if (!(await isSweepLeader())) return; // another replica owns the sweep
    try { await sweepExpiredAttempts(); } catch (err) { logger.error('[exam-maintenance] sweep failed', { message: err.message }); }
    try { await redriveStuckGrading(); } catch (err) { logger.error('[exam-maintenance] re-drive failed', { message: err.message }); }
  };
  const runRetention = async () => {
    if (!(await isSweepLeader())) return;
    try { await purgeOldProctorShots(); } catch (err) { logger.error('[exam-maintenance] retention failed', { message: err.message }); }
  };
  run(); // run once at boot to clear anything that expired while we were down
  runRetention();
  const sweepHandle = setInterval(run, SWEEP_INTERVAL_MS);
  const retentionHandle = setInterval(runRetention, RETENTION_INTERVAL_MS);
  sweepHandle.unref?.(); // don't keep the process alive solely for the timers
  retentionHandle.unref?.();
  return { sweepHandle, retentionHandle };
}
