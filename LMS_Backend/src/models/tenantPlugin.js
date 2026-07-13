import mongoose from 'mongoose';
import { UserRole } from '#shared';
import { currentTenant } from '../services/tenantContext.js';

// Every read/write op we auto-scope by organization.
const QUERY_HOOKS = [
  'count', 'countDocuments', 'find', 'findOne', 'findOneAndUpdate',
  'findOneAndDelete', 'findOneAndReplace', 'updateOne', 'updateMany',
  'deleteOne', 'deleteMany', 'distinct',
];

/** Returns the org to scope to, or null to skip scoping (system / super admin). */
function scopeOrg() {
  const ctx = currentTenant();
  if (!ctx) return null; // unauthenticated / background / seed → global
  if (ctx.role === UserRole.SUPER_ADMIN) return null; // full oversight → all orgs
  return ctx.organization || null; // legacy null-org users → unscoped (backward compat)
}

/**
 * Applied globally to every schema. No-ops on schemas WITHOUT an `organization`
 * path (e.g. Organization itself), so only tenant collections are scoped.
 */
export function tenantPlugin(schema) {
  if (!schema.path('organization')) return;

  schema.pre(QUERY_HOOKS, function tenantScopeQuery() {
    const org = scopeOrg();
    if (!org) return;
    const q = this.getQuery();
    if (!('organization' in q)) q.organization = org; // don't override an explicit filter
  });

  schema.pre('aggregate', function tenantScopeAggregate() {
    const org = scopeOrg();
    if (!org) return;
    this.pipeline().unshift({ $match: { organization: new mongoose.Types.ObjectId(org) } });
  });

  schema.pre('save', function tenantStampSave() {
    if (this.isNew && this.organization == null) {
      const org = scopeOrg();
      if (org) this.organization = org;
    }
  });

  schema.pre('insertMany', function tenantStampInsertMany(next, docs) {
    const org = scopeOrg();
    if (org && Array.isArray(docs)) {
      for (const d of docs) if (d && d.organization == null) d.organization = org;
    }
    next();
  });
}
