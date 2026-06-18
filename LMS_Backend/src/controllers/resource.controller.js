import path from 'node:path';
import multer from 'multer';
import { z } from 'zod';
import { ResourceType, UserRole } from '#shared';
import { Batch, Module, Resource, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';
import { storeUpload, deleteByUrl } from '../services/fileStore.js';

const objectId = z.string().length(24);
export const moduleQuery = z.object({ module: objectId });
export const resourceIdParam = z.object({ id: objectId });

// ── Multer (in-memory → MongoDB/GridFS via fileStore) ─────────────────────────
// Allowlist learning-material types only — block executables/scripts/HTML to
// avoid stored-XSS or malware being served from our origin.
const ALLOWED_EXT = new Set([
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.md', '.csv',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', // .svg excluded — it can carry executable scripts (stored XSS)
  '.mp4', '.webm', '.mov', '.mp3', '.wav', '.zip',
]);
const BLOCKED_MIME = /(text\/html|application\/x-msdownload|application\/x-sh|application\/javascript)/i;

export const uploadResourceFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 }, // 100 MB, single file
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext) || BLOCKED_MIME.test(file.mimetype)) {
      return cb(new ApiError(400, 'UNSUPPORTED_FILE', `File type not allowed: ${ext || file.mimetype}`));
    }
    cb(null, true);
  },
}).single('file');

const addBodySchema = z.object({
  module: objectId,
  type: z.nativeEnum(ResourceType),
  title: z.string().min(1).max(200),
  topic: objectId.optional(),
  url: z.string().url().optional(), // required when no file is uploaded
});

/** Admin, or a trainer assigned to the module. Returns the module doc. */
async function loadModuleForEdit(moduleId, auth) {
  const module = await Module.findById(moduleId).select('assignedTrainers');
  if (!module) throw ApiError.badRequest('Module not found');
  if (auth.role === UserRole.TRAINER) {
    const assigned = module.assignedTrainers.some((t) => t.toString() === auth.userId);
    if (!assigned) throw ApiError.forbidden('You are not assigned to this module');
  }
  return module;
}

/** Can the requester view this module's resources? */
async function assertCanView(moduleId, auth) {
  if (auth.role === UserRole.ADMIN) return;
  if (auth.role === UserRole.TRAINER) return; // trainers may browse the catalog
  // Student: only if the module is part of their batch.
  const me = await User.findById(auth.userId).select('batch');
  if (!me?.batch) throw ApiError.forbidden('You are not enrolled in a batch');
  const inBatch = await Batch.exists({ _id: me.batch, modules: moduleId });
  if (!inBatch) throw ApiError.forbidden('This module is not part of your curriculum');
}

// ── Handlers ────────────────────────────────────────────────────────────────

export async function listResources(req, res) {
  const moduleId = req.query.module;
  await assertCanView(moduleId, req.auth);
  let resources = await Resource.find({ module: moduleId })
    .sort({ createdAt: -1 })
    .populate('uploadedBy', 'name');

  // Students only see resources for topics their trainer has marked TAUGHT in
  // their batch (i.e. released). Trainers/admins see everything.
  if (req.auth.role === UserRole.STUDENT) {
    const me = await User.findById(req.auth.userId).select('batch');
    const batch = me?.batch ? await Batch.findById(me.batch).select('taughtTopics') : null;
    const entry = batch?.taughtTopics?.find((tt) => tt.module.toString() === moduleId);
    const taught = new Set((entry?.topics ?? []).map((t) => t.toString()));
    resources = resources.filter((r) => r.topic && taught.has(r.topic.toString()));
  }
  ok(res, resources.map((r) => r.toJSON()));
}

/** Add a resource — either an uploaded file (multipart `file`) or an external `url`. */
export async function addResource(req, res) {
  const parsed = addBodySchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest('Validation failed', parsed.error.flatten());
  const { module, type, title, topic, url } = parsed.data;

  await loadModuleForEdit(module, req.auth);

  let finalUrl = url;
  if (req.file) {
    finalUrl = (await storeUpload(req.file, 'resource')).url;
  } else if (!url) {
    throw ApiError.badRequest('Provide a file upload or a url');
  }

  const resource = await Resource.create({
    module,
    topic,
    type,
    title,
    url: finalUrl,
    uploadedBy: req.auth.userId,
  });
  ok(res, resource.toJSON(), 201);
}

export async function deleteResource(req, res) {
  const resource = await Resource.findById(req.params.id);
  if (!resource) throw ApiError.notFound('Resource not found');
  await loadModuleForEdit(resource.module, req.auth);
  await deleteByUrl(resource.url); // remove the stored file (if it was an upload)
  await resource.deleteOne();
  ok(res, { id: req.params.id, deleted: true });
}
