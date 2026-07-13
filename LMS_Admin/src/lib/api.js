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
  // Super-admin drill-in: scope the request to the selected organization.
  const ov = orgViewStore.get();
  if (ov?.id) config.headers['X-Org-Id'] = ov.id;
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
      tokenStore.clear();
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
