import path from 'node:path';
import multer from 'multer';
import { z } from 'zod';
import { ThemeName } from '#shared';
import { getSettings, getStoredSebConfigKey } from '../models/index.js';
import { env } from '../config/env.js';
import { gridfsStorage } from '../services/fileStore.js';
import { aiKeySource, getEvaluator } from '../services/aiGrading.js';
import { verifyZoom, zoomConfigured, zoomSource } from '../services/meetings.js';
import { livekitConfigured } from '../services/livekit.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';

export const updateSettingsSchema = z
  .object({
    passingScore: z.number().int().min(0).max(100).optional(),
    minAttendance: z.number().int().min(0).max(100).optional(),
    allowSelfRegistration: z.boolean().optional(),
    activeTheme: z.nativeEnum(ThemeName).optional(),
    // Safe Exam Browser — global Config Key + config-file URL.
    sebConfigKey: z.string().max(200).optional(),
    sebConfigUrl: z.string().max(1000).optional(),
    // Write-only secrets. Empty string clears the value. Never read back.
    aiApiKey: z.string().max(200).optional(),
    zoomAccountId: z.string().max(200).optional(),
    zoomClientId: z.string().max(200).optional(),
    zoomClientSecret: z.string().max(200).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No settings provided' });

/** Public-safe view of settings (never includes the AI key). */
async function settingsView(s) {
  return {
    id: s.id,
    passingScore: s.passingScore,
    minAttendance: s.minAttendance,
    allowSelfRegistration: s.allowSelfRegistration,
    activeTheme: s.activeTheme,
    sebConfigUrl: s.sebConfigUrl || '',
    sebConfigured: Boolean(await getStoredSebConfigKey()), // key itself is select:false / never returned

    aiConfigured: (await aiKeySource()) !== 'none',
    aiKeySource: await aiKeySource(),
    aiKeyLocked: Boolean(env.anthropicApiKey), // env wins → UI field is read-only
    zoomConfigured: await zoomConfigured(),
    zoomSource: await zoomSource(),
    zoomLocked: Boolean(env.zoomAccountId && env.zoomClientId && env.zoomClientSecret),
    livekitConfigured: livekitConfigured(), // in-app live classes

    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

/** PUBLIC — the bits the login/registration screens need before auth. */
export async function getPublicSettings(_req, res) {
  const s = await getSettings();
  ok(res, { activeTheme: s.activeTheme, allowSelfRegistration: s.allowSelfRegistration });
}

/** Admin: full settings (AI key masked to a boolean + source). */
export async function getAllSettings(_req, res) {
  ok(res, await settingsView(await getSettings()));
}

/** Admin: update one or more settings. */
export async function updateSettings(req, res) {
  const s = await getSettings();
  // aiApiKey is select:false on the loaded doc; assigning + saving persists it.
  Object.assign(s, req.body);
  await s.save();
  const { audit } = await import('../services/audit.js');
  audit(req, 'settings.update', { targetType: 'settings', meta: { changed: Object.keys(req.body) } }); // keys only, never secret values
  ok(res, await settingsView(s));
}

// ── Safe Exam Browser config upload (.seb) → MongoDB/GridFS ───────────────────
export const uploadSebConfig = multer({
  storage: gridfsStorage('seb'),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.seb') return cb(new ApiError(400, 'UNSUPPORTED_FILE', 'Upload a Safe Exam Browser .seb config file.'));
    cb(null, true);
  },
}).single('config');

/** Admin: store an uploaded .seb config and point students at it. */
export async function setSebConfig(req, res) {
  if (!req.file) throw ApiError.badRequest('Choose a .seb config file to upload.');
  const s = await getSettings();
  s.sebConfigUrl = req.file.url;
  await s.save();
  ok(res, await settingsView(s));
}

/** Admin: verify the configured Claude key with a tiny live call. */
export async function testAiConnection(_req, res) {
  const evaluator = await getEvaluator();
  if (!evaluator) {
    throw ApiError.badRequest('No Claude API key configured. Set ANTHROPIC_API_KEY or save one in Settings.');
  }
  try {
    const result = await evaluator.verifyConnection();
    ok(res, { ok: true, model: result.model, source: await aiKeySource() });
  } catch (err) {
    throw ApiError.badRequest(`Claude connection failed: ${err.message}`);
  }
}

/** Admin: verify the configured Zoom credentials. */
export async function testZoomConnection(_req, res) {
  try {
    const result = await verifyZoom();
    ok(res, { ok: true, source: result.source });
  } catch (err) {
    throw ApiError.badRequest(`Zoom connection failed: ${err.message}`);
  }
}
