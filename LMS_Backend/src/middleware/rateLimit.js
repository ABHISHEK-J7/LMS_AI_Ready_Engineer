import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisEnabled, getRedis } from '../services/redis.js';

/**
 * Build a rate limiter backed by Redis when REDIS_URL is set (so the limit is
 * shared across all backend replicas), or the default in-memory store otherwise
 * (single instance). Use everywhere instead of calling rateLimit() directly.
 */
export function makeLimiter(options) {
  const store = redisEnabled()
    ? new RedisStore({ prefix: 'rl:', sendCommand: async (...args) => (await getRedis()).call(...args) })
    : undefined;
  return rateLimit({ standardHeaders: true, legacyHeaders: false, ...options, store });
}
