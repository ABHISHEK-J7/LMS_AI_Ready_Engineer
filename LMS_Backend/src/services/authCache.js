/**
 * In-process cache of the per-user auth facts the `authenticate` middleware needs
 * on EVERY request — `{ tokenVersion, status, role, name }`. Without it, each
 * authenticated request does a `User.findById`, which dominates DB load and ties
 * up the connection pool at high concurrency.
 *
 * Correctness: entries are TTL-bounded AND invalidated immediately on the
 * mutations that change tokenVersion/status (logout, password change, archive,
 * erase, approve, status update) — so revocation stays effectively instant. Role
 * is immutable per user (not editable), and a slightly stale display name only
 * affects audit labels, so neither needs invalidation.
 *
 * Multi-instance: when REDIS_URL is set, invalidations are published over Redis
 * pub/sub so every replica drops its local copy — reads stay fast (local map)
 * while revocation still propagates cluster-wide.
 */
import { redisEnabled, getRedis, getSubscriber } from './redis.js';

const TTL_MS = 60_000;
const MAX_ENTRIES = 50_000;
const CHANNEL = 'authcache:invalidate';
const cache = new Map(); // userId -> { value, exp }

// Subscribe once (no-op when Redis is disabled) so other instances' invalidations
// drop our local copy.
let subInit = false;
async function ensureSubscribed() {
  if (subInit || !redisEnabled()) return;
  subInit = true;
  try {
    const sub = await getSubscriber();
    if (!sub) return;
    await sub.subscribe(CHANNEL);
    sub.on('message', (ch, msg) => { if (ch === CHANNEL) cache.delete(msg); });
  } catch { /* non-fatal */ }
}
ensureSubscribed();

export function getAuthUser(userId) {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (entry.exp <= Date.now()) {
    cache.delete(userId);
    return null;
  }
  return entry.value;
}

export function setAuthUser(userId, value) {
  // Cheap bound: when full, drop the oldest insertion (Map preserves order).
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(userId, { value, exp: Date.now() + TTL_MS });
}

export function invalidateAuthUser(userId) {
  if (userId == null) return;
  cache.delete(String(userId));
  if (redisEnabled()) {
    getRedis().then((r) => r?.publish(CHANNEL, String(userId))).catch(() => {});
  }
}
