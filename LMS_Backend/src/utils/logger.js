import { env } from '../config/env.js';

/**
 * Tiny dependency-free structured logger.
 *  - Production: one JSON object per line (level, time, msg, ...meta) so a log
 *    shipper (CloudWatch, Loki, Datadog) can parse + index it.
 *  - Development: a compact, readable line.
 * Levels below the configured LOG_LEVEL are dropped.
 */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[env.logLevel] ?? LEVELS.info;

function emit(level, msg, meta) {
  if (LEVELS[level] < threshold) return;
  const time = new Date().toISOString();
  if (env.isProd) {
    const line = { level, time, msg, ...(meta && typeof meta === 'object' ? meta : meta != null ? { detail: meta } : {}) };
    // eslint-disable-next-line no-console
    (level === 'error' ? console.error : console.log)(JSON.stringify(line));
  } else {
    const tag = level.toUpperCase().padEnd(5);
    const extra = meta != null ? ` ${typeof meta === 'string' ? meta : JSON.stringify(meta)}` : '';
    // eslint-disable-next-line no-console
    (level === 'error' ? console.error : console.log)(`${time} ${tag} ${msg}${extra}`);
  }
}

export const logger = {
  debug: (msg, meta) => emit('debug', msg, meta),
  info: (msg, meta) => emit('info', msg, meta),
  warn: (msg, meta) => emit('warn', msg, meta),
  error: (msg, meta) => emit('error', msg, meta),
};

// ── Optional Sentry integration ───────────────────────────────────────────────
// Enabled only when SENTRY_DSN is set AND @sentry/node is installed. Kept fully
// optional so the dependency is not required for the app to run.
let sentry = null;

export async function initSentry() {
  if (!env.sentryDsn) return null;
  try {
    const mod = await import('@sentry/node');
    const Sentry = mod.default ?? mod;
    Sentry.init({ dsn: env.sentryDsn, environment: env.nodeEnv, tracesSampleRate: 0 });
    sentry = Sentry;
    logger.info('[sentry] error monitoring enabled');
    return Sentry;
  } catch {
    logger.warn('[sentry] SENTRY_DSN is set but @sentry/node is not installed — run `npm i @sentry/node` to enable');
    return null;
  }
}

/** Report an error to Sentry if configured; always a no-op-safe call. */
export function captureError(err, context) {
  if (!sentry) return;
  try {
    sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    /* never let monitoring break the request */
  }
}
