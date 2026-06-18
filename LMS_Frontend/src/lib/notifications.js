import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './api';

const KEY = ['notifications'];

/** The signed-in user's notifications (polled to keep the bell fresh). */
export function useNotifications() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => unwrap(api.get('/notifications')),
    refetchInterval: 60_000,
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.post('/notifications/read')),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
