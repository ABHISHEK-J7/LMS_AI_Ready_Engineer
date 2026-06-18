import { UserStatus } from '#shared';
import {
  Attendance,
  Certificate,
  ClassRating,
  Doubt,
  ExternalCertificate,
  Notification,
  Project,
  Submission,
  User,
} from '../models/index.js';
import { UPLOADS_URL_PREFIX } from '../config/storage.js';
import { deleteByUrl } from './fileStore.js';
import { logger } from '../utils/logger.js';

/** Delete a stored file referenced by a public /api/uploads URL (best-effort). */
function unlinkUpload(url) {
  deleteByUrl(url);
}

/**
 * GDPR "right of access": assemble everything we hold about a user into a single
 * portable JSON bundle. Secrets (password/OTP hashes) are never included — they
 * are `select:false` and not fetched here.
 */
export async function collectUserData(userId) {
  const user = await User.findById(userId).populate('batch', 'name code');
  if (!user) return null;

  const [submissions, attendance, certificates, externalCerts, projects, doubts, ratings, notifications] = await Promise.all([
    Submission.find({ student: userId }).populate('assessment', 'title type').sort({ createdAt: -1 }),
    Attendance.find({ student: userId }).populate('module', 'name code').populate('classSession', 'title date').sort({ markedAt: -1 }),
    Certificate.find({ student: userId }).sort({ createdAt: -1 }),
    ExternalCertificate.find({ student: userId }).sort({ createdAt: -1 }),
    Project.find({ student: userId }).sort({ createdAt: -1 }),
    Doubt.find({ student: userId }).sort({ createdAt: -1 }),
    ClassRating.find({ student: userId }).sort({ createdAt: -1 }),
    Notification.find({ user: userId }).sort({ createdAt: -1 }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      phone: user.phone ?? null,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      links: user.links ?? {},
      customLinks: user.customLinks ?? [],
      batch: user.batch ? { name: user.batch.name, code: user.batch.code } : null,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null,
    },
    submissions: submissions.map((s) => ({
      assessment: s.assessment ? { title: s.assessment.title, type: s.assessment.type } : null,
      status: s.status,
      score: s.score ?? null,
      passed: s.passed ?? null,
      disqualified: s.disqualified,
      warnings: s.warnings,
      startedAt: s.startedAt ?? null,
      submittedAt: s.submittedAt ?? null,
    })),
    attendance: attendance.map((a) => a.toJSON()),
    certificates: certificates.map((c) => c.toJSON()),
    externalCertificates: externalCerts.map((c) => c.toJSON()),
    projects: projects.map((p) => p.toJSON()),
    doubts: doubts.map((d) => d.toJSON()),
    classRatings: ratings.map((r) => r.toJSON()),
    notifications: notifications.map((n) => n.toJSON()),
  };
}

/**
 * GDPR "right to erasure": irreversibly anonymize a user's personal data and
 * delete the files they uploaded, while preserving de-identified academic
 * records (submissions/attendance/certificates) for institutional integrity.
 * Returns a summary of what was removed.
 */
export async function eraseUserData(user) {
  const userId = user.id;

  // 1) Delete uploaded files: avatar, project screenshots, proctor snapshots,
  //    and any self-uploaded certificate files.
  unlinkUpload(user.avatarUrl);
  const [projects, submissions, externalCerts] = await Promise.all([
    Project.find({ student: userId }).select('images'),
    Submission.find({ student: userId }).select('proctorShots'),
    ExternalCertificate.find({ student: userId }).select('url'),
  ]);
  let filesRemoved = user.avatarUrl?.startsWith(UPLOADS_URL_PREFIX) ? 1 : 0;
  for (const p of projects) for (const img of p.images ?? []) { unlinkUpload(img); filesRemoved += 1; }
  for (const s of submissions) for (const shot of s.proctorShots ?? []) { unlinkUpload(shot); filesRemoved += 1; }
  for (const c of externalCerts) { unlinkUpload(c.url); }

  // 2) Clear proctor snapshot references that now point at deleted files.
  await Submission.updateMany({ student: userId, 'proctorShots.0': { $exists: true } }, { $set: { proctorShots: [] } });

  // 3) Anonymize the profile in place. A unique sentinel email keeps the unique
  //    index satisfied while removing the real address.
  const anonEmail = `deleted-${userId}@deleted.invalid`;
  user.name = 'Deleted user';
  user.email = anonEmail;
  user.phone = undefined;
  user.bio = undefined;
  user.avatarUrl = undefined;
  user.links = {};
  user.customLinks = [];
  user.passwordHash = undefined;
  user.otpHash = undefined;
  user.otpExpiresAt = undefined;
  user.status = UserStatus.ARCHIVED;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1; // revoke any outstanding tokens
  await user.save();

  logger.info('[gdpr] erased user data', { userId, filesRemoved });
  return { userId, filesRemoved, anonymizedEmail: anonEmail };
}
