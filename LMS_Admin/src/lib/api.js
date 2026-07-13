import axios from 'axios';

const ACCESS_KEY = 'lms.accessToken';
const REFRESH_KEY = 'lms.refreshToken';
const FILE_KEY = 'lms.fileToken';

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  get file() {
    return localStorage.getItem(FILE_KEY);
  },
  set(tokens) {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    if (tokens.fileToken) localStorage.setItem(FILE_KEY, tokens.fileToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(FILE_KEY);
  },
};

// Which organization a SUPER ADMIN is currently "drilled into". When set, the API
// sends X-Org-Id so the backend scopes every request to that org (the super admin
// acts as its admin). Ignored by the backend for non-super-admins.
const ORGVIEW_KEY = 'lms.orgView';
export const orgViewStore = {
  get() {
    try { return JSON.parse(localStorage.getItem(ORGVIEW_KEY)) || null; } catch { return null; }
  },
  set(org) {
    if (org?.id) localStorage.setItem(ORGVIEW_KEY, JSON.stringify({ id: org.id, name: org.name }));
    else localStorage.removeItem(ORGVIEW_KEY);
  },
  clear() { localStorage.removeItem(ORGVIEW_KEY); },
};

// Whether the CURRENT session is the super admin. Only a super-admin session may
// attach the X-Org-Id scoping header — so a stale `lms.orgView` in localStorage can
// never make a plain admin's requests carry an org header. Set by the auth store.
let superAdminSession = false;
export function setSuperAdminSession(value) { superAdminSession = Boolean(value); }

// The super admin's Master-Template org id (fetched at login). Curriculum pages in
// super-admin "managing" mode scope to it, so the modules the super admin edits ARE
// the template that seeds new orgs.
const TEMPLATE_KEY = 'lms.templateOrg';
export const templateOrgStore = {
  get() {
    try { return JSON.parse(localStorage.getItem(TEMPLATE_KEY)) || null; } catch { return null; }
  },
  set(org) {
    if (org?.id) localStorage.setItem(TEMPLATE_KEY, JSON.stringify({ id: org.id, name: org.name }));
    else localStorage.removeItem(TEMPLATE_KEY);
  },
  clear() { localStorage.removeItem(TEMPLATE_KEY); },
};

/**
 * Resolve a stored-file URL (`/api/uploads/...`) into a `<img>/<video>/<a>`-safe
 * src by appending the file-access token (browsers can't send the Authorization
 * header on media requests). External links are returned untouched.
 */
export function fileSrc(url) {
  if (!url || typeof url !== 'string') return url;
  if (!url.startsWith('/api/uploads/') && !url.startsWith('/uploads/')) return url;
  const t = tokenStore.file;
  return t ? `${url}${url.includes('?') ? '&' : '?'}t=${encodeURIComponent(t)}` : url;
}

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Super-admin scoping via X-Org-Id (only ever attached for a super-admin session):
  //  - drilled into an org  -> that org (acts as its admin)
  //  - otherwise (global)   -> the master template org, so curriculum pages edit it.
  // The /organizations endpoints are super-admin-only and MUST keep the global
  // (no-header) context, so they are never scoped — regardless of drill-in state.
  const url = config.url || '';
  const isOrgAdminApi = url.startsWith('/organizations');
  if (superAdminSession && !isOrgAdminApi) {
    const orgId = orgViewStore.get()?.id ?? templateOrgStore.get()?.id;
    if (orgId) config.headers['X-Org-Id'] = orgId;
  }
  return config;
});

// On a 401, try a one-shot refresh, then replay the original request.
let refreshing = null;

async function refreshAccessToken() {
  const refresh = tokenStore.refresh;
  if (!refresh) return null;
  try {
    const { data } = await axios.post('/api/auth/refresh', {
      refreshToken: refresh,
    });
    if (data.data) {
      tokenStore.set(data.data.tokens);
      return data.data.tokens.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      refreshing = refreshing ?? refreshAccessToken();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      // Refresh failed → the session is dead. Clear it and send them to login
      // instead of stranding them on a half-broken, error-filled page.
      tokenStore.clear();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);

/** Unwrap our standard envelope, throwing a friendly message on failure. */
export async function unwrap(promise) {
  const { data } = await promise;
  if (!data.success || data.data === undefined) {
    throw new Error(data.error?.message ?? 'Request failed');
  }
  return data.data;
}

/**
 * Download a file from an authenticated endpoint (e.g. a CSV/JSON export).
 * Fetches as a blob (so the Authorization header is sent) and triggers a save.
 */
export async function downloadFile(path, fallbackName = 'download') {
  const res = await api.get(path, { responseType: 'blob' });
  const disposition = res.headers['content-disposition'] ?? '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match ? match[1] : fallbackName;
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function apiErrorMessage(err) {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data;
    return body?.error?.message ?? err.message;
  }
  return err instanceof Error ? err.message : 'Unexpected error';
}
