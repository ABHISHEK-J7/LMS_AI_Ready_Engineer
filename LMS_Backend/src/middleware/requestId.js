import { randomUUID } from 'node:crypto';

/**
 * Assign a correlation id to every request (honoring an upstream X-Request-Id
 * from a proxy/load balancer) and echo it back. Used to tie a client-visible
 * error to its server log line.
 */
export function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  req.id = typeof incoming === 'string' && incoming.length <= 100 ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
