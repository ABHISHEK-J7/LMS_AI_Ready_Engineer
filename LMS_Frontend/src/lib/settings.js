import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './api';

export const settingsKeys = {
  public: ['settings', 'public'],
  all: ['settings', 'all'],
};

/** PUBLIC — activeTheme + allowSelfRegistration, no auth required. */
export function usePublicSettings() {
  return useQuery({
    queryKey: settingsKeys.public,
    queryFn: () => unwrap(api.get('/settings/public')),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

/** Admin: full settings. */
export function useSettings({ enabled = true } = {}) {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: () => unwrap(api.get('/settings')),
    enabled,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => unwrap(api.patch('/settings', body)),
    onSuccess: (data) => {
      qc.setQueryData(settingsKeys.all, data);
      qc.invalidateQueries({ queryKey: settingsKeys.public });
    },
  });
}

/** Admin: verify the configured Claude API key with a tiny live call. */
export function useTestAiConnection() {
  return useMutation({ mutationFn: () => unwrap(api.post('/settings/test-ai')) });
}

/** Admin: verify the configured Zoom credentials. */
export function useTestZoomConnection() {
  return useMutation({ mutationFn: () => unwrap(api.post('/settings/test-zoom')) });
}
