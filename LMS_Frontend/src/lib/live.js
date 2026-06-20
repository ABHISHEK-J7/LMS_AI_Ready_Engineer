import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from './api';

/**
 * Fetch a LiveKit access token (+ server url + class metadata) for an in-app
 * live class. Tokens are short-lived and minted per entry, so we fetch on mount
 * and don't aggressively refetch.
 */
export function useLiveToken(classId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['live-token', classId],
    queryFn: () => unwrap(api.post(`/classes/${classId}/live-token`)),
    enabled: Boolean(classId) && enabled,
    staleTime: 1000 * 60 * 20,
    gcTime: 1000 * 60 * 20,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
