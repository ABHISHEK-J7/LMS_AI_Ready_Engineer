import { UserRole, UserStatus } from '#shared';
import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { getAuthUser, setAuthUser } from '../services/authCache.js';
import { tenantStore } from '../services/tenantContext.js';

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

    // Cache the auth facts to avoid a DB read on every request (invalidated on
    // logout/password-change/archive/suspend; 60s TTL otherwise).
    let info = getAuthUser(payload.sub);
    if (!info) {
      const user = await User.findById(payload.sub).select('tokenVersion status role name organization');
      if (!user) throw ApiError.unauthorized('Account no longer exists');
      info = {
        tokenVersion: user.tokenVersion ?? 0,
        status: user.status,
        role: user.role,
        name: user.name,
        organization: user.organization ? user.organization.toString() : null,
      };
      setAuthUser(payload.sub, info);
    }

    if ((payload.tv ?? 0) !== (info.tokenVersion ?? 0)) {
      throw ApiError.unauthorized('Session expired — please sign in again');
    }
    if (info.status === UserStatus.ARCHIVED || info.status === UserStatus.SUSPENDED) {
      throw ApiError.forbidden('Your account is not active. Contact your administrator.');
    }

    // Super-admin "drill in": when a super admin targets an org via the X-Org-Id
    // header, they ACT AS an admin of that org — reusing all admin logic + scoping,
    // with no per-controller changes. Without the header they stay the global super
    // admin (only the /organizations routes apply).
    let effectiveRole = info.role;
    let effectiveOrg = info.organization ?? null;
    if (info.role === UserRole.SUPER_ADMIN) {
      const target = req.headers['x-org-id'];
      if (target && /^[0-9a-fA-F]{24}$/.test(target)) {
        effectiveRole = UserRole.ADMIN;
        effectiveOrg = target;
      }
    }

    req.auth = { userId: payload.sub, role: effectiveRole, name: info.name, organization: effectiveOrg, isSuperAdmin: info.role === UserRole.SUPER_ADMIN };
    // Run the rest of the request inside the tenant context so every DB query is
    // auto-scoped to this org (see models/tenantPlugin.js).
    tenantStore.run({ role: effectiveRole, organization: effectiveOrg }, () => next());
  } catch (err) {
    next(err);
  }
}

/** Restrict a route to one or more roles. Use after `authenticate`. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.auth) throw ApiError.unauthorized();
    // The super admin has full oversight — allowed on every role-guarded route
    // (except where a route explicitly restricts to SUPER_ADMIN only, which lists it).
    if (req.auth.role === UserRole.SUPER_ADMIN || roles.includes(req.auth.role)) {
      return next();
    }
    throw ApiError.forbidden(`Requires role: ${roles.join(' or ')}`);
  };
}
