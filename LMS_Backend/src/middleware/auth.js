import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';

/** Require a valid access token; attaches `req.auth`. */
export function authenticate(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, role: payload.role };
    next();
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }
}

/** Restrict a route to one or more roles. Use after `authenticate`. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.auth) throw ApiError.unauthorized();
    if (!roles.includes(req.auth.role)) {
      throw ApiError.forbidden(`Requires role: ${roles.join(' or ')}`);
    }
    next();
  };
}
