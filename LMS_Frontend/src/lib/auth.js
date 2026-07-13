import { create } from 'zustand';
import { UserRole } from '@/shared';
import { api, tokenStore, unwrap } from './api';

/** The main app serves students & trainers. Administrators and the super admin
 *  use the separate Admin portal (a super admin here would see broken cross-org UI). */
function rejectAdmin(user) {
  if (user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN) {
    const err = new Error('Administrators sign in through the Admin portal.');
    err.code = 'IS_ADMIN';
    throw err;
  }
}

export const useAuth = create((set) => ({
  user: null,
  status: 'loading',

  async login(email, password) {
    const result = await unwrap(api.post('/auth/login', { email, password }));
    try {
      rejectAdmin(result.user);
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

  /** Replace the cached user (e.g. after a profile/avatar update). */
  setUser(user) {
    set({ user });
  },

  async bootstrap() {
    if (!tokenStore.access) {
      set({ status: 'unauthenticated' });
      return;
    }
    try {
      const { user } = await unwrap(api.get('/auth/me'));
      rejectAdmin(user); // an admin token must not unlock the student/trainer app
      set({ user, status: 'authenticated' });
    } catch {
      tokenStore.clear();
      set({ user: null, status: 'unauthenticated' });
    }
  },
}));
