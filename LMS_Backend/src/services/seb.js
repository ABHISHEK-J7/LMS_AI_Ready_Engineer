import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { getSettings, getStoredSebConfigKey } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

// Safe Exam Browser sends this header on every request: SHA256(absoluteURL + ConfigKey).
const CONFIG_KEY_HEADER = 'x-safeexambrowser-configkeyhash';

/** The absolute URL of the request as the SEB browser saw it (used in the hash). */
function requestUrl(req) {
  if (env.sebBaseUrl) return env.sebBaseUrl.replace(/\/+$/, '') + req.originalUrl;
  return `${req.protocol}://${req.get('host')}${req.originalUrl}`;
}

/** True if the request carries a valid SEB Config-Key hash for `configKey`. */
export function isValidSebRequest(req, configKey) {
  if (!configKey) return false;
  const sent = req.get(CONFIG_KEY_HEADER);
  if (!sent) return false;
  const expected = crypto.createHash('sha256').update(requestUrl(req) + configKey).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(sent).toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** The global SEB Config Key + the config-file URL students launch from. */
export async function sebConfig() {
  const s = await getSettings();
  return { key: await getStoredSebConfigKey(), url: s.sebConfigUrl || '' };
}

/** Per-request SEB status for an assessment (used to drive the launch screen). */
export async function sebStatus(req, assessment) {
  if (!assessment.requireSeb) return { requireSeb: false, sebOk: true, sebConfigUrl: '' };
  const { key, url } = await sebConfig();
  return { requireSeb: true, sebOk: isValidSebRequest(req, key), sebConfigUrl: url };
}

/** Throw if the assessment requires SEB and this isn't a valid SEB request. */
export async function assertSeb(req, assessment) {
  if (!assessment.requireSeb) return;
  const { key } = await sebConfig();
  if (!key) throw ApiError.badRequest('This exam requires Safe Exam Browser, but it has not been configured by your administrator yet.');
  if (!isValidSebRequest(req, key)) {
    throw ApiError.forbidden('This exam must be opened in Safe Exam Browser.');
  }
}
