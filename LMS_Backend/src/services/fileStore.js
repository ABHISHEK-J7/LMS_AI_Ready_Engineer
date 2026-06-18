import path from 'node:path';
import mongoose from 'mongoose';
import { UPLOADS_URL_PREFIX } from '../config/storage.js';

/**
 * GridFS-backed file storage. All uploads (avatars, learning resources, videos,
 * project shots, proctor snapshots, certificates, SEB configs) live in MongoDB
 * — there is no on-disk upload directory. Files are served back through the
 * `/api/uploads/:filename` route with HTTP Range support so video/audio stream
 * and seek. The public URL scheme (`/api/uploads/<filename>`) is unchanged, so
 * existing stored URLs keep resolving after the migration.
 */
const BUCKET = 'uploads';

/** GridFSBucket on the live mongoose connection. Constructed per call (cheap) so
 *  it always targets the current connection (important for tests that reconnect). */
export function getBucket() {
  const db = mongoose.connection?.db;
  if (!db) throw new Error('Database not connected — cannot access file storage');
  return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET });
}

/** Save a Buffer under `filename`, returning { filename, url }. */
export function saveBuffer(buffer, { filename, contentType } = {}) {
  return new Promise((resolve, reject) => {
    const stream = getBucket().openUploadStream(filename, {
      contentType: contentType || 'application/octet-stream',
    });
    stream.on('error', reject);
    stream.on('finish', () => resolve({ filename, url: `${UPLOADS_URL_PREFIX}/${filename}` }));
    stream.end(buffer);
  });
}

/**
 * Store a multer in-memory file under a generated, collision-proof name.
 * @param {{buffer:Buffer, originalname?:string, mimetype?:string}} file
 * @param {string} prefix e.g. 'avatar' | 'resource' | 'project' | 'cert' | 'proctor' | 'seb'
 */
export async function storeUpload(file, prefix = 'file') {
  const ext = path.extname(file.originalname || '');
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filename = `${prefix}-${stamp}${ext}`;
  return saveBuffer(file.buffer, { filename, contentType: file.mimetype });
}

/** Look up a stored file's metadata doc by name (or null). */
export async function findFile(filename) {
  return getBucket().find({ filename }).limit(1).next();
}

/** Delete every stored version of `filename`. Best-effort; returns count removed. */
export async function deleteByName(filename) {
  const bucket = getBucket();
  const files = await bucket.find({ filename }).toArray();
  await Promise.all(files.map((f) => bucket.delete(f._id).catch(() => {})));
  return files.length;
}

/** Delete a stored file given its public `/api/uploads/<name>` URL (best-effort). */
export async function deleteByUrl(url) {
  if (typeof url === 'string' && url.startsWith(UPLOADS_URL_PREFIX)) {
    await deleteByName(path.basename(url)).catch(() => {});
  }
}

/**
 * Express handler: stream a stored file back, with Range support (206) so video
 * and audio seek/stream. Re-applies the upload hardening headers.
 */
export async function serveUpload(req, res) {
  const { filename } = req.params;
  const file = await findFile(filename);
  if (!file) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox allow-same-origin",
  );
  res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=3600');

  const total = file.length;
  const range = req.headers.range;

  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? parseInt(m[2], 10) : total - 1;
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start < 0 || end >= total) {
        res.setHeader('Content-Range', `bytes */${total}`);
        return res.status(416).end();
      }
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', end - start + 1);
      // GridFS download-stream end offset is exclusive.
      const stream = getBucket().openDownloadStreamByName(filename, { start, end: end + 1 });
      stream.on('error', () => res.destroy());
      return stream.pipe(res);
    }
  }

  res.setHeader('Content-Length', total);
  const stream = getBucket().openDownloadStreamByName(filename);
  stream.on('error', () => res.destroy());
  return stream.pipe(res);
}
