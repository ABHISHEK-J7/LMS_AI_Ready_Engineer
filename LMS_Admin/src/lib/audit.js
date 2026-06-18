import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from './api';

/** Admin: recent audit-log entries (optionally filtered by action). */
export function useAuditLog(action = '') {
  const params = action ? { action } : {};
  return useQuery({
    queryKey: ['audit', params],
    queryFn: () => unwrap(api.get('/audit', { params })),
  });
}
