import path from 'node:path';
import multer from 'multer';
import { z } from 'zod';
import { PROJECT_MAX_IMAGES, ProjectStatus, UserRole } from '#shared';
import { Batch, Project } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';
import { gridfsStorage, deleteByUrl } from '../services/fileStore.js';

const objectId = z.string().length(24);
export const projectIdParam = z.object({ id: objectId });
export const reviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(500).optional(),
});

// ── Multer (up to PROJECT_MAX_IMAGES screenshots → MongoDB/GridFS) ────────────
const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
export const uploadProjectImages = multer({
  storage: gridfsStorage('project'),
  limits: { fileSize: 10 * 1024 * 1024, files: PROJECT_MAX_IMAGES }, // 10 MB each
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new ApiError(400, 'UNSUPPORTED_FILE', `Screenshots must be images. Not allowed: ${ext || file.mimetype}`));
    }
    cb(null, true);
  },
}).array('images', PROJECT_MAX_IMAGES);

const createSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(160),
  description: z.string().min(10, 'Add a short description (at least 10 characters)').max(4000),
  repoUrl: z.string().url('Enter a valid GitHub repository URL').max(1000),
});

function cleanupImages(images = []) {
  for (const url of images) deleteByUrl(url);
}

/** The signed-in student's own projects, newest first. */
export async function listMine(req, res) {
  const projects = await Project.find({ student: req.auth.userId }).sort({ createdAt: -1 });
  ok(res, projects.map((p) => p.toJSON()));
}

/** Submit a new project (title, repo URL, description + screenshot images). */
export async function create(req, res) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest('Validation failed', parsed.error.flatten());
  if (!req.files?.length) throw ApiError.badRequest('Add at least one project screenshot');

  // Files were streamed to GridFS by the multer engine; record their URLs.
  const images = req.files.map((f) => f.url);
  const project = await Project.create({
    student: req.auth.userId,
    title: parsed.data.title,
    description: parsed.data.description,
    repoUrl: parsed.data.repoUrl,
    images,
  });
  ok(res, project.toJSON(), 201);
}

/** Delete one of the student's own projects (best-effort image cleanup). */
export async function remove(req, res) {
  const project = await Project.findOne({ _id: req.params.id, student: req.auth.userId });
  if (!project) throw ApiError.notFound('Project not found');
  cleanupImages(project.images);
  await project.deleteOne();
  ok(res, { id: req.params.id, deleted: true });
}

// ── Review (trainer / admin) ──────────────────────────────────────────────────

/** Which students' projects may this reviewer act on? Admin = all (null);
 *  trainer = students in the batches they're assigned to. */
async function reviewableStudentIds(req) {
  if (req.auth.role === UserRole.ADMIN) return null;
  const batches = await Batch.find({ trainers: req.auth.userId }).select('students');
  return [...new Set(batches.flatMap((b) => b.students.map((s) => s.toString())))];
}

/** Projects a trainer/admin can review — pending first, then recently reviewed. */
export async function listForReview(req, res) {
  const studentIds = await reviewableStudentIds(req);
  const filter = studentIds ? { student: { $in: studentIds } } : {};
  const projects = await Project.find(filter)
    .populate('student', 'name email')
    .populate('reviewedBy', 'name');
  const rank = { [ProjectStatus.PENDING]: 0, [ProjectStatus.APPROVED]: 1, [ProjectStatus.REJECTED]: 2 };
  const sorted = projects.sort((a, b) => (rank[a.status] - rank[b.status]) || (b.createdAt - a.createdAt));
  ok(res, sorted.map((p) => p.toJSON()));
}

/** Approve or reject a student's project. */
export async function review(req, res) {
  const { decision, note } = req.body;
  const project = await Project.findById(req.params.id);
  if (!project) throw ApiError.notFound('Project not found');

  const studentIds = await reviewableStudentIds(req);
  if (studentIds && !studentIds.includes(project.student.toString())) {
    throw ApiError.forbidden('This student is not in your batches');
  }

  project.status = decision === 'approve' ? ProjectStatus.APPROVED : ProjectStatus.REJECTED;
  project.reviewedBy = req.auth.userId;
  project.reviewedAt = new Date();
  project.note = note ?? undefined;
  await project.save();

  const { notify } = await import('../services/notify.js');
  notify(project.student, {
    type: 'approval',
    title: `Project ${decision === 'approve' ? 'approved' : 'rejected'}: ${project.title}`,
    body: decision === 'approve' ? 'It now appears on your profile.' : (note || 'Please review and resubmit.'),
    link: '/app/profile',
  });

  const populated = await Project.findById(project._id)
    .populate('student', 'name email')
    .populate('reviewedBy', 'name');
  ok(res, populated.toJSON());
}
