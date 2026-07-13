import mongoose from 'mongoose';
import { UserRole } from '#shared';
import { currentTenant, ambientOrgId } from '../services/tenantContext.js';

// Every read/write op we auto-scope by organization.
const QUERY_HOOKS = [
  'count', 'countDocuments', 'find', 'findOne', 'findOneAndUpdate',
  'findOneAndDelete', 'findOneAndReplace', 'updateOne', 'updateMany',
  'deleteOne', 'deleteMany', 'distinct',
];

// Returned by scopeOrg() when the caller is a NON-super user with no organization.
// Such a context must NEVER run unscoped (that would read/write every org's data),
// so queries are forced to an impossible match and writes are refused.
const DENY = Symbol('tenant-deny');
// A valid-but-impossible ObjectId: no real Organization is ever the zero id, so
// scoping a query to it deterministically matches nothing.
const NO_MATCH = new mongoose.Types.ObjectId('000000000000000000000000');

/**
 * Resolve the tenant scope for QUERIES from the current async context:
 *   - null   → skip scoping (no context: seed/background/unauth, OR super admin)
 *   - string → scope to this organization id
 *   - DENY   → a non-super caller with no org: deny all access (never unscoped)
 */
function scopeOrg() {
  const ctx = currentTenant();
  if (!ctx) return null; // unauthenticated / background / seed → global
  if (ctx.role === UserRole.SUPER_ADMIN) return null; // full oversight → all orgs
  return ctx.organization || DENY; // a real tenant MUST carry an org, else deny
}

/**
 * Resolve the org to STAMP onto a new document. Same as scopeOrg(), except that
 * with no request context it falls back to the test-only ambient org (so fixtures
 * created via direct model calls carry an org). In production the ambient org is
 * never set, so this is null and the create stays global (seed/system).
 */
function stampOrg() {
  const ctx = currentTenant();
  if (!ctx) return ambientOrgId() || null;
  if (ctx.role === UserRole.SUPER_ADMIN) return null;
  return ctx.organization || DENY;
}

/**
 * Applied globally to every schema. No-ops on schemas WITHOUT an `organization`
 * path (e.g. Organization itself), so only tenant collections are scoped.
 */
export function tenantPlugin(schema) {
  if (!schema.path('organization')) return;

  schema.pre(QUERY_HOOKS, function tenantScopeQuery() {
    const org = scopeOrg();
    if (org === null) return; // global (super admin / no context)
    const q = this.getQuery();
    if (org === DENY) { q.organization = NO_MATCH; return; } // deny: force no match
    if (!('organization' in q)) q.organization = org; // don't override an explicit filter
  });

  schema.pre('aggregate', function tenantScopeAggregate() {
    const org = scopeOrg();
    if (org === null) return;
    const oid = org === DENY ? NO_MATCH : new mongoose.Types.ObjectId(org);
    this.pipeline().unshift({ $match: { organization: oid } });
  });

  // Some schemas (Settings) keep a legitimate global doc with organization=null and
  // must NOT pick up the test-only ambient org; they stamp from context only.
  const orgForStamp = () => (schema.$ambientExempt ? scopeOrg() : stampOrg());

  schema.pre('save', function tenantStampSave() {
    if (!this.isNew) return;
    const org = orgForStamp();
    if (org === DENY) throw new Error('Refusing to create a tenant document without an organization.');
    if (org && this.organization == null) this.organization = org;
  });

  schema.pre('insertMany', function tenantStampInsertMany(next, docs) {
    const org = orgForStamp();
    if (org === DENY) return next(new Error('Refusing to insert tenant documents without an organization.'));
    if (org && Array.isArray(docs)) {
      for (const d of docs) if (d && d.organization == null) d.organization = org;
    }
    next();
  });
}
