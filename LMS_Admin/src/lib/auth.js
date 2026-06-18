import { create } from 'zustand';
import { UserRole } from '@/shared';
import { api, tokenStore, unwrap } from './api';

/** This is the ADMIN portal — only administrators may sign in here. */
function assertAdmin(user) {
  if (user?.role !== UserRole.ADMIN) {
    const err = new Error('This portal is for administrators only.');
    err.code = 'NOT_ADMIN';
    throw err;
  }
}

export const useAuth = create((set) => ({
  user: null,
  status: 'loading',

  async login(email, password) {
    const result = await unwrap(api.post('/auth/login', { email, password }));
    try {
      assertAdmin(result.user);
    } catch (err) {
      tokenStore.clear();
      throw err;
    }
    tokenStore.set(result.tokens);
    set({ user: result.user, status: 'authenticated' });
    return result.user;
  },

  async logout() {
    try { await api.post('/auth/logout'); } catch { /* best-effort: revoke refresh tokens server-side */ }
    tokenStore.clear();
    set({ user: null, status: 'unauthenticated' });
  },

  async bootstrap() {
    if (!tokenStore.access) {
      set({ status: 'unauthenticated' });
      return;
    }
    try {
      const { user } = await unwrap(api.get('/auth/me'));
      assertAdmin(user); // a non-admin token must not unlock the admin portal
      set({ user, status: 'authenticated' });
    } catch {
      tokenStore.clear();
      set({ user: null, status: 'unauthenticated' });
    }
  },
}));
