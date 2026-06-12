import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { z } from 'zod';
import { ExternalCertificate } from '../models/index.js';
import { ensureUploadsDir, UPLOADS_URL_PREFIX } from '../config/storage.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';

const objectId = z.string().length(24);
export const externalCertIdParam = z.object({ id: objectId });

// ── Multer (single file → LMS_Storage/uploads) ────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ensureUploadsDir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40);
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `cert-${stamp}-${base}${ext}`);
  },
});
const ALLOWED_EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp']);
export const uploadCertFile = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 1 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new ApiError(400, 'UNSUPPORTED_FILE', `Use a PDF or image. Not allowed: ${ext || file.mimetype}`));
    }
    cb(null, true);
  },
}).single('file');

const createSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(160),
  issuer: z.string().max(120).optional(),
  url: z.string().url('Enter a valid link').max(1000).optional(),
});

/** The signed-in student's own external certificates, newest first. */
export async function listMine(req, res) {
  const certs = await ExternalCertificate.find({ student: req.auth.userId }).sort({ createdAt: -1 });
  ok(res, certs.map((c) => c.toJSON()));
}

/** Add an external certificate — a link OR an uploaded file (PDF/image). */
export async function create(req, res) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest('Validation failed', parsed.error.flatten());
  const { title, issuer, url } = parsed.data;

  let finalUrl = url;
  if (req.file) {
    finalUrl = `${UPLOADS_URL_PREFIX}/${req.file.filename}`;
  } else if (!url) {
    throw ApiError.badRequest('Provide a link or upload a file');
  }

  const cert = await ExternalCertificate.create({
    student: req.auth.userId,
    title,
    issuer,
    url: finalUrl,
  });
  ok(res, cert.toJSON(), 201);
}

/** Delete one of the student's own external certificates. */
export async function remove(req, res) {
  const cert = await ExternalCertificate.findOne({ _id: req.params.id, student: req.auth.userId });
  if (!cert) throw ApiError.notFound('Certificate not found');

  // Best-effort cleanup of an uploaded file.
  if (cert.url?.startsWith(UPLOADS_URL_PREFIX)) {
    const file = path.join(ensureUploadsDir(), path.basename(cert.url));
    fs.promises.unlink(file).catch(() => {});
  }
  await cert.deleteOne();
  ok(res, { id: req.params.id, deleted: true });
}
