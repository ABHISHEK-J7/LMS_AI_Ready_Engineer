import { UserStatus } from '#shared';
import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';

/**
 * Require a valid access token; attaches `req.auth`. Beyond signature/expiry,
 * this validates the token's `tv` against the user's current `tokenVersion` and
 * the account status — so logout, password change, and suspension/archive take
 * effect immediately (not only when the short-lived access token expires).
 * Cost: one lean `findById` per authenticated request (acceptable at this scale;
 * cache tokenVersion if/when request volume demands it).
 */
export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Missing or malformed Authorization header');
    }
    const token = header.slice('Bearer '.length).trim();
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw ApiError.unauthorized('Invalid or expired access token');
    }

    const user = await User.findById(payload.sub).select('tokenVersion status role name');
    if (!user) throw ApiError.unauthorized('Account no longer exists');
    if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      throw ApiError.unauthorized('Session expired — please sign in again');
    }
    if (user.status === UserStatus.ARCHIVED || user.status === UserStatus.SUSPENDED) {
      throw ApiError.forbidden('Your account is not active. Contact your administrator.');
    }

    req.auth = { userId: user.id, role: user.role, name: user.name };
    next();
  } catch (err) {
    next(err);
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
