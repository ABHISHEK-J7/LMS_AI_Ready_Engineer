import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './api';

export const classKeys = {
  all: ['classes'],
  list: (filters) => ['classes', 'list', filters ?? {}],
};

/** filters: { batch, module, status, from, to } — undefined keys are omitted. */
export function useClasses(filters = {}) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''),
  );
  return useQuery({
    queryKey: classKeys.list(params),
    queryFn: () => unwrap(api.get('/classes', { params })),
  });
}

function useClassInvalidation() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: classKeys.all });
}

export function useCreateClass() {
  const invalidate = useClassInvalidation();
  return useMutation({ mutationFn: (body) => unwrap(api.post('/classes', body)), onSuccess: invalidate });
}

/** Bulk-create a weekly recurring series. */
export function useCreateRecurringClasses() {
  const invalidate = useClassInvalidation();
  return useMutation({ mutationFn: (body) => unwrap(api.post('/classes/recurring', body)), onSuccess: invalidate });
}

export function useUpdateClass() {
  const invalidate = useClassInvalidation();
  return useMutation({
    mutationFn: ({ id, ...body }) => unwrap(api.patch(`/classes/${id}`, body)),
    onSuccess: invalidate,
  });
}

export function useDeleteClass() {
  const invalidate = useClassInvalidation();
  return useMutation({ mutationFn: (id) => unwrap(api.delete(`/classes/${id}`)), onSuccess: invalidate });
}

/** Student records their entry time on the first "Join" click. */
export function useJoinClass() {
  return useMutation({ mutationFn: (id) => unwrap(api.post(`/classes/${id}/join`)) });
}
