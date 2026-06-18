/**
 * Public URL prefix uploaded files are served under (proxied via /api in dev).
 * Files themselves are stored in MongoDB (GridFS) — see services/fileStore.js —
 * not on disk. This constant is the single source of truth for that path.
 */
export const UPLOADS_URL_PREFIX = '/api/uploads';
