/**
 * One-off migration: copy every file from the legacy on-disk upload directory
 * (LMS_Storage/uploads) into MongoDB/GridFS, preserving the exact filename so
 * the existing `/api/uploads/<filename>` URLs stored in documents keep resolving.
 *
 * Idempotent: a file already present in GridFS (by name) is skipped, so it's
 * safe to re-run. Usage:  node scripts/migrate-uploads-to-gridfs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

const UPLOADS_DIR = fileURLToPath(new URL('../../LMS_Storage/uploads/', import.meta.url));

const MIME = {
  '.pdf': 'application/pdf',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
  '.seb': 'application/octet-stream',
};

function uploadFile(bucket, filePath, filename, contentType) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(bucket.openUploadStream(filename, { contentType }))
      .on('error', reject)
      .on('finish', resolve);
  });
}

async function main() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log(`[migrate] no legacy uploads dir at ${UPLOADS_DIR} — nothing to do.`);
    return;
  }
  await mongoose.connect(env.mongoUri);
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });

  const entries = fs.readdirSync(UPLOADS_DIR).filter((f) => f !== '.gitkeep' && !f.startsWith('.'));
  let migrated = 0, skipped = 0, failed = 0;

  for (const filename of entries) {
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.statSync(filePath).isFile()) continue;
    const existing = await bucket.find({ filename }).limit(1).next();
    if (existing) { skipped += 1; continue; }
    const contentType = MIME[path.extname(filename).toLowerCase()] || 'application/octet-stream';
    try {
      await uploadFile(bucket, filePath, filename, contentType);
      migrated += 1;
      console.log(`[migrate] ✓ ${filename} (${contentType})`);
    } catch (err) {
      failed += 1;
      console.error(`[migrate] ✗ ${filename}: ${err.message}`);
    }
  }

  console.log(`\n[migrate] done — ${migrated} migrated, ${skipped} already present, ${failed} failed (of ${entries.length}).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[migrate] fatal:', err);
  process.exit(1);
});
