import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Optional Redis. Enabled only when REDIS_URL is set — required to run more than
 * one backend instance (shared rate-limit store, cross-instance auth-cache
 * invalidation, single-leader sweeper). When unset, the app runs single-instance
 * with in-memory equivalents and these helpers no-op.
 */
export function redisEnabled() {
  return Boolean(env.redisUrl);
}

let client = null;
let subscriber = null;

/** Main Redis connection (commands). Lazily created. */
export async function getRedis() {
  if (!redisEnabled()) return null;
  if (client) return client;
  const { default: Redis } = await import('ioredis');
  client = new Redis(env.redisUrl, { maxRetriesPerRequest: 2, lazyConnect: false });
  client.on('error', (e) => logger.error('[redis] error', { message: e.message }));
  client.on('connect', () => logger.info('[redis] connected'));
  return client;
}

/** A second connection dedicated to pub/sub (a subscribed client can't issue
 *  normal commands). Lazily created. */
export async function getSubscriber() {
  if (!redisEnabled()) return null;
  if (subscriber) return subscriber;
  const { default: Redis } = await import('ioredis');
  subscriber = new Redis(env.redisUrl, { maxRetriesPerRequest: 2 });
  subscriber.on('error', (e) => logger.error('[redis] sub error', { message: e.message }));
  return subscriber;
}
