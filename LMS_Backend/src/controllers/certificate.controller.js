import { z } from 'zod';
import { UserRole } from '@lms/shared';
import { Certificate, User } from '../models/index.js';
import { issueEligibleCertificates, listStudentCertificates } from '../services/certificates.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';

export const certIdParam = z.object({ certificateId: z.string().min(4).max(64) });
export const studentIdParam = z.object({ studentId: z.string().length(24) });

/** PUBLIC — resolve a certificate id (what the QR code links to). No auth. */
export async function verifyCertificate(req, res) {
  const cert = await Certificate.findOne({ certificateId: req.params.certificateId })
    .populate('student', 'name')
    .populate('module', 'name code');
  if (!cert) {
    return ok(res, { valid: false });
  }
  ok(res, {
    valid: true,
    certificateId: cert.certificateId,
    studentName: cert.student?.name ?? 'Unknown',
    moduleName: cert.module?.name ?? null,
    isProgramCertificate: cert.isProgramCertificate,
    issuedAt: cert.issuedAt,
  });
}

/** Student: ensure any newly-earned certificates are issued, then return own list. */
export async function myCertificates(req, res) {
  await issueEligibleCertificates(req.auth.userId);
  const certs = await listStudentCertificates(req.auth.userId);
  ok(res, certs.map((c) => c.toJSON()));
}

/** Admin/trainer: a specific student's certificates (also ensures issuance). */
export async function studentCertificates(req, res) {
  const student = await User.findById(req.params.studentId).select('name email role');
  if (!student || student.role !== UserRole.STUDENT) throw ApiError.notFound('Student not found');
  await issueEligibleCertificates(req.params.studentId);
  const certs = await listStudentCertificates(req.params.studentId);
  ok(res, { student: student.toJSON(), certificates: certs.map((c) => c.toJSON()) });
}

/** Admin: every issued certificate. */
export async function listAllCertificates(_req, res) {
  const certs = await Certificate.find()
    .sort({ issuedAt: -1 })
    .populate('student', 'name email')
    .populate('module', 'name code');
  ok(res, certs.map((c) => c.toJSON()));
}
