import { create } from 'zustand';
import { UserRole } from '@/shared';
import { api, tokenStore, orgViewStore, templateOrgStore, setSuperAdminSession, unwrap } from './api';

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
 * (Modules / Question Bank) scope to it via X-Org-Id, and mark this a super-admin
 * session (gates the X-Org-Id header). Returns whether the template is missing so
 * the UI can warn instead of silently editing nothing.
 */
async function syncTemplateOrg(user) {
  const isSuper = user?.role === UserRole.SUPER_ADMIN;
  setSuperAdminSession(isSuper);
  if (!isSuper) { templateOrgStore.clear(); return { templateMissing: false }; }
  try {
    const org = await unwrap(api.get('/organizations/template'));
    templateOrgStore.set({ id: org.id, name: org.name });
    return { templateMissing: false };
  } catch {
    templateOrgStore.clear();
    return { templateMissing: true };
  }
}

export const useAuth = create((set) => ({
  user: null,
  status: 'loading',
  // Which org a super admin is currently drilled into (null = managing organizations).
  orgView: orgViewStore.get(),
  // True when the super admin's master-template org couldn't be resolved (warn in UI).
  templateMissing: false,

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
    const { templateMissing } = await syncTemplateOrg(result.user);
    set({ user: result.user, status: 'authenticated', orgView: null, templateMissing });
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
    setSuperAdminSession(false);
    set({ user: null, status: 'unauthenticated', orgView: null, templateMissing: false });
  },

  async bootstrap() {
    if (!tokenStore.access) {
      set({ status: 'unauthenticated' });
      return;
    }
    try {
      const { user } = await unwrap(api.get('/auth/me'));
      assertPortalUser(user);
      const { templateMissing } = await syncTemplateOrg(user);
      set({ user, status: 'authenticated', orgView: orgViewStore.get(), templateMissing });
    } catch {
      tokenStore.clear();
      orgViewStore.clear();
      templateOrgStore.clear();
      setSuperAdminSession(false);
      set({ user: null, status: 'unauthenticated', orgView: null, templateMissing: false });
    }
  },
}));
