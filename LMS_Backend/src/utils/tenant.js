import { UserRole } from '#shared';
import { ApiError } from './ApiError.js';

/**
 * Multi-tenant scoping helpers.
 *
 * Every tenant-scoped document carries an `organization`. These helpers ensure a
 * query only ever sees the caller's own organization — except the super admin, who
 * has full oversight of all orgs (and may narrow to one via `?org=<id>`).
 */

/** A Mongo filter fragment scoping a read to the caller's org. Spread into find():
 *  Model.find({ ...orgFilter(req), ...otherConditions }). */
export function orgFilter(req, { param = 'org' } = {}) {
  if (req.auth.role === UserRole.SUPER_ADMIN) {
    const target = req.query?.[param];
    return target ? { organization: target } : {}; // all orgs, or one if targeted
  }
  return { organization: req.auth.organization };
}

/** The organization id to STAMP on a document the caller is creating. The super
 *  admin has no org of their own, so they must target one (body.organization / ?org=). */
export function orgOf(req, { bodyKey = 'organization', param = 'org' } = {}) {
  if (req.auth.role === UserRole.SUPER_ADMIN) {
    const target = req.body?.[bodyKey] || req.query?.[param];
    if (!target) throw ApiError.badRequest('Super admin must specify a target organization.');
    return target;
  }
  return req.auth.organization;
}

/** True if the caller may touch a document belonging to `docOrgId`. */
export function sameOrg(req, docOrgId) {
  if (req.auth.role === UserRole.SUPER_ADMIN) return true;
  if (!docOrgId) return false;
  return docOrgId.toString() === String(req.auth.organization);
}

/** Throw unless the caller may access `docOrgId` (super admin bypasses). */
export function assertSameOrg(req, docOrgId, message = 'This item belongs to another organization') {
  if (!sameOrg(req, docOrgId)) throw ApiError.forbidden(message);
}
