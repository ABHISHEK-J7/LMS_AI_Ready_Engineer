import QRCode from 'qrcode';
import { Certificate } from '../models/index.js';
import { env } from '../config/env.js';
import { computeProgress } from './progression.js';

/** Build the public verification URL the QR code encodes. */
function verifyUrl(certificateId) {
  return `${env.appBaseUrl.replace(/\/$/, '')}/verify/${certificateId}`;
}

/** Human-readable, unique-ish certificate id, e.g. AIRE-PE-2025-7F3A2K. */
function makeCertificateId(code) {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AIRE-${code}-${year}-${rand}`;
}

async function createCertificate({ student, module, isProgramCertificate, code }) {
  // Retry a couple of times in the (very unlikely) event of an id collision.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const certificateId = makeCertificateId(code);
    const url = verifyUrl(certificateId);
    let qrDataUrl;
    try {
      qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });
    } catch {
      qrDataUrl = undefined;
    }
    try {
      return await Certificate.create({
        certificateId,
        student,
        module,
        isProgramCertificate: Boolean(isProgramCertificate),
        issuedAt: new Date(),
        verifyUrl: url,
        qrDataUrl,
      });
    } catch (err) {
      // Retry only on a random certificateId clash. A collision on the
      // (student, module, kind) unique index means a concurrent call already
      // issued this certificate — propagate so the caller can ignore it.
      if (err?.code === 11000 && err?.keyPattern?.certificateId && attempt < 2) continue;
      throw err;
    }
  }
  throw new Error('Could not generate a unique certificate id');
}

/** True for a duplicate-key error from the (student, module, kind) unique index. */
function isAlreadyIssued(err) {
  return err?.code === 11000 && !err?.keyPattern?.certificateId;
}

/**
 * Issue any certificates the student has newly become eligible for. Idempotent:
 * one per-module certificate per completed module, plus one program certificate
 * once every module is complete. Safe to call repeatedly (e.g. after grading or
 * when the student opens their certificates page).
 *
 * @returns {Promise<{ issued: number }>}
 */
export async function issueEligibleCertificates(studentId) {
  const progress = await computeProgress(studentId);
  if (!progress.hasBatch) return { issued: 0 };

  let issued = 0;

  for (const entry of progress.modules) {
    // A module certificate is earned by MASTERY (passing the final + attendance),
    // not by merely advancing past the module when the syllabus is complete.
    if (!entry.passed) continue;
    const exists = await Certificate.findOne({
      student: studentId,
      module: entry.module.id,
      isProgramCertificate: false,
    });
    if (exists) continue;
    try {
      await createCertificate({ student: studentId, module: entry.module.id, code: entry.module.code });
      issued += 1;
      const { notify } = await import('./notify.js');
      notify(studentId, { type: 'certificate', title: `Certificate earned: ${entry.module.name}`, body: 'Congratulations! Your module certificate is ready.', link: '/app/certificates' });
    } catch (err) {
      if (!isAlreadyIssued(err)) throw err; // concurrent call beat us to it — fine
    }
  }

  if (progress.eligibleForCertificate) {
    const exists = await Certificate.findOne({ student: studentId, isProgramCertificate: true });
    if (!exists) {
      try {
        await createCertificate({ student: studentId, isProgramCertificate: true, code: 'PROGRAM' });
        issued += 1;
        const { notify } = await import('./notify.js');
        notify(studentId, { type: 'certificate', title: 'Program certificate earned 🎓', body: 'You completed every module — your program certificate is ready.', link: '/app/certificates' });
      } catch (err) {
        if (!isAlreadyIssued(err)) throw err;
      }
    }
  }

  return { issued };
}

/** Fetch a student's certificates (module populated), newest first. */
export async function listStudentCertificates(studentId) {
  return Certificate.find({ student: studentId })
    .sort({ issuedAt: -1 })
    .populate('module', 'name code');
}
