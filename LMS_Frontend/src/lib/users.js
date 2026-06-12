import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './api';

export const userKeys = {
  all: ['users'],
  list: (filters) => ['users', 'list', filters ?? {}],
};

/** Fetch up to `pageSize` users of a role (admin-only endpoint). */
export function useUsersByRole(role, { enabled = true, pageSize = 200 } = {}) {
  return useQuery({
    queryKey: ['users', 'byRole', role, pageSize],
    enabled,
    queryFn: async () => {
      const page = await unwrap(api.get('/users', { params: { role, pageSize } }));
      return page.items;
    },
  });
}

export const useStudents = (opts) => useUsersByRole('student', opts);
export const useTrainers = (opts) => useUsersByRole('trainer', opts);

/** Admin: paginated, filterable directory. Returns { items, page, pageSize, total }. */
export function useUsers(filters = {}) {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null));
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => unwrap(api.get('/users', { params })),
    placeholderData: (prev) => prev, // keep previous page visible while fetching the next
  });
}

function useUsersInvalidation() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: userKeys.all });
}

export function useCreateUser() {
  const invalidate = useUsersInvalidation();
  return useMutation({ mutationFn: (body) => unwrap(api.post('/users', body)), onSuccess: invalidate });
}

export function useUpdateUser() {
  const invalidate = useUsersInvalidation();
  return useMutation({
    mutationFn: ({ id, ...body }) => unwrap(api.patch(`/users/${id}`, body)),
    onSuccess: invalidate,
  });
}

export function useApproveUser() {
  const invalidate = useUsersInvalidation();
  return useMutation({ mutationFn: (id) => unwrap(api.post(`/users/${id}/approve`)), onSuccess: invalidate });
}

export function useArchiveUser() {
  const invalidate = useUsersInvalidation();
  return useMutation({ mutationFn: (id) => unwrap(api.delete(`/users/${id}`)), onSuccess: invalidate });
}
