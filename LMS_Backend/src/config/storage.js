import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Absolute path to the shared LMS_Storage/uploads directory (sibling of LMS_Backend).
 * From src/config/storage.js: ../../../ → repo root → LMS_Storage/uploads.
 */
export const uploadsDir = fileURLToPath(new URL('../../../LMS_Storage/uploads/', import.meta.url));

/** Public URL prefix uploaded files are served under (proxied via /api in dev). */
export const UPLOADS_URL_PREFIX = '/api/uploads';

export function ensureUploadsDir() {
  fs.mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
}
