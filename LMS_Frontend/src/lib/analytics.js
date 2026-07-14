import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from './api';

export const analyticsKeys = {
  admin: ['analytics', 'admin'],
  trainer: ['analytics', 'trainer'],
  student: ['analytics', 'student'],
};

export function useStudentAnalytics({ enabled = true } = {}) {
  return useQuery({
    queryKey: analyticsKeys.student,
    queryFn: () => unwrap(api.get('/analytics/student')),
    enabled,
  });
}

export function useAdminAnalytics({ enabled = true } = {}) {
  return useQuery({
    queryKey: analyticsKeys.admin,
    queryFn: () => unwrap(api.get('/analytics/admin')),
    enabled,
  });
}

export function useTrainerAnalytics({ enabled = true } = {}) {
  return useQuery({
    queryKey: analyticsKeys.trainer,
    queryFn: () => unwrap(api.get('/analytics/trainer')),
    enabled,
  });
}
