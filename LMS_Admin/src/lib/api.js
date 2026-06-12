import axios from 'axios';

const ACCESS_KEY = 'lms.accessToken';
const REFRESH_KEY = 'lms.refreshToken';

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(tokens) {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
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

export function apiErrorMessage(err) {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data;
    return body?.error?.message ?? err.message;
  }
  return err instanceof Error ? err.message : 'Unexpected error';
}
