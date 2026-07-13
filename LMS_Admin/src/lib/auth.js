import { create } from 'zustand';
import { UserRole } from '@/shared';
import { api, tokenStore, orgViewStore, templateOrgStore, unwrap } from './api';

const PORTAL_ROLES = [UserRole.ADMIN, UserRole.SUPER_ADMIN];

/** This is the ADMIN portal — only administrators and the super admin may sign in. */
function assertPortalUser(user) {
  if (!PORTAL_ROLES.includes(user?.role)) {
    const err = new Error('This portal is for administrators only.');
    err.code = 'NOT_ADMIN';
    throw err;
  }
}

/**
 * For the super admin, remember the master-template org id so curriculum pages
 * (Modules / Question Bank) scope to it via X-Org-Id. Best-effort: a missing
 * template just leaves the super admin's curriculum pages empty.
 */
async function syncTemplateOrg(user) {
  if (user?.role !== UserRole.SUPER_ADMIN) { templateOrgStore.clear(); return; }
  try {
    const org = await unwrap(api.get('/organizations/template'));
    templateOrgStore.set({ id: org.id, name: org.name });
  } catch { templateOrgStore.clear(); }
}

export const useAuth = create((set) => ({
  user: null,
  status: 'loading',
  // Which org a super admin is currently drilled into (null = managing organizations).
  orgView: orgViewStore.get(),

  async login(email, password) {
    const result = await unwrap(api.post('/auth/login', { email, password }));
    try {
      assertPortalUser(result.user);
    } catch (err) {
      tokenStore.clear();
      throw err;
    }
    tokenStore.set(result.tokens);
    orgViewStore.clear();
    await syncTemplateOrg(result.user);
    set({ user: result.user, status: 'authenticated', orgView: null });
    return result.user;
  },

  /** Super admin: drill into an organization (act as its admin). */
  setOrgView(org) {
    orgViewStore.set(org);
    set({ orgView: org ? { id: org.id, name: org.name } : null });
  },
  clearOrgView() {
    orgViewStore.clear();
    set({ orgView: null });
  },

  async logout() {
    try { await api.post('/auth/logout'); } catch { /* best-effort */ }
    tokenStore.clear();
    orgViewStore.clear();
    templateOrgStore.clear();
    set({ user: null, status: 'unauthenticated', orgView: null });
  },

  async bootstrap() {
    if (!tokenStore.access) {
      set({ status: 'unauthenticated' });
      return;
    }
    try {
      const { user } = await unwrap(api.get('/auth/me'));
      assertPortalUser(user);
      await syncTemplateOrg(user);
      set({ user, status: 'authenticated', orgView: orgViewStore.get() });
    } catch {
      tokenStore.clear();
      orgViewStore.clear();
      templateOrgStore.clear();
      set({ user: null, status: 'unauthenticated', orgView: null });
    }
  },
}));
