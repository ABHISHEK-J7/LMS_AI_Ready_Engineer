import { AsyncLocalStorage } from 'node:async_hooks';
import { UserRole } from '#shared';

/**
 * Per-request tenant context. `authenticate` runs the rest of each request inside
 * this store, carrying { role, organization }. The Mongoose tenant plugin reads it
 * to auto-scope every query/insert to the caller's organization — so a query can
 * never accidentally leak another org's data.
 *
 * No context (unauthenticated routes, background jobs, the seed) → no scoping, which
 * is exactly what those system-level paths need.
 */
export const tenantStore = new AsyncLocalStorage();

/** The active tenant context, or null. */
export function currentTenant() {
  return tenantStore.getStore() ?? null;
}

/**
 * Run `fn` with tenant scoping DISABLED, so queries/writes see every org. For GLOBAL
 * super-admin operations that must span all orgs (e.g. the syllabus-request approvals
 * inbox) even when the request carried an X-Org-Id "drill-in" header that would
 * otherwise scope them to a single org. Callers MUST enforce super-admin themselves.
 */
export function runUnscoped(fn) {
  return tenantStore.run(undefined, fn);
}

/**
 * Run `fn` as an admin of `orgId`, so any documents it creates are stamped/scoped to
 * that organization. Used to place a side-effect (like a notification) into the right
 * tenant even while the surrounding request is running unscoped or in another org.
 */
export function runAsOrg(orgId, fn) {
  return tenantStore.run({ role: UserRole.ADMIN, organization: orgId ? String(orgId) : null }, fn);
}

// TEST-ONLY: an ambient org used to stamp writes that happen OUTSIDE any request
// context (test fixtures created via direct model calls). Never set in production,
// where such creates are system/seed operations that must stay global. It only
// affects write-stamping, never query scoping — so it can't hide a scoping bug.
let ambientOrg = null;
export function setAmbientOrg(org) { ambientOrg = org ? String(org) : null; }
export function ambientOrgId() { return ambientOrg; }
