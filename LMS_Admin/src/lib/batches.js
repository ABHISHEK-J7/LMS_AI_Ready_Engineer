import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './api';

export const batchKeys = {
  all: ['batches'],
  list: (opts) => ['batches', 'list', opts ?? {}],
  detail: (id) => ['batches', 'detail', id],
};

export function useBatches({ archived = false } = {}) {
  return useQuery({
    queryKey: batchKeys.list({ archived }),
    queryFn: () => unwrap(api.get('/batches', { params: archived ? { archived: 'true' } : {} })),
  });
}

export function useBatch(id) {
  return useQuery({
    queryKey: batchKeys.detail(id),
    queryFn: () => unwrap(api.get(`/batches/${id}`)),
    enabled: Boolean(id),
  });
}

function useBatchInvalidation() {
  const qc = useQueryClient();
  return (batch) => {
    qc.invalidateQueries({ queryKey: batchKeys.all });
    if (batch?.id) qc.setQueryData(batchKeys.detail(batch.id), batch);
  };
}

export function useCreateBatch() {
  const invalidate = useBatchInvalidation();
  return useMutation({ mutationFn: (body) => unwrap(api.post('/batches', body)), onSuccess: invalidate });
}

export function useUpdateBatch() {
  const invalidate = useBatchInvalidation();
  return useMutation({
    mutationFn: ({ id, ...body }) => unwrap(api.patch(`/batches/${id}`, body)),
    onSuccess: invalidate,
  });
}

export function useArchiveBatch() {
  const invalidate = useBatchInvalidation();
  return useMutation({ mutationFn: (id) => unwrap(api.delete(`/batches/${id}`)), onSuccess: invalidate });
}

export function useAssignStudents() {
  const invalidate = useBatchInvalidation();
  return useMutation({
    mutationFn: ({ id, ids }) => unwrap(api.post(`/batches/${id}/students`, { ids })),
    onSuccess: invalidate,
  });
}
export function useRemoveStudent() {
  const invalidate = useBatchInvalidation();
  return useMutation({
    mutationFn: ({ id, memberId }) => unwrap(api.delete(`/batches/${id}/students/${memberId}`)),
    onSuccess: invalidate,
  });
}

export function useAssignTrainers() {
  const invalidate = useBatchInvalidation();
  return useMutation({
    mutationFn: ({ id, ids }) => unwrap(api.post(`/batches/${id}/trainers`, { ids })),
    onSuccess: invalidate,
  });
}
export function useRemoveTrainer() {
  const invalidate = useBatchInvalidation();
  return useMutation({
    mutationFn: ({ id, memberId }) => unwrap(api.delete(`/batches/${id}/trainers/${memberId}`)),
    onSuccess: invalidate,
  });
}

export function useAssignModules() {
  const invalidate = useBatchInvalidation();
  return useMutation({
    mutationFn: ({ id, ids }) => unwrap(api.post(`/batches/${id}/modules`, { ids })),
    onSuccess: invalidate,
  });
}
export function useRemoveModule() {
  const invalidate = useBatchInvalidation();
  return useMutation({
    mutationFn: ({ id, memberId }) => unwrap(api.delete(`/batches/${id}/modules/${memberId}`)),
    onSuccess: invalidate,
  });
}

/** Set which trainers deliver one module in this batch (replaces the set). */
export function useSetModuleTrainers() {
  const invalidate = useBatchInvalidation();
  return useMutation({
    mutationFn: ({ id, moduleId, trainerIds }) =>
      unwrap(api.put(`/batches/${id}/modules/${moduleId}/trainers`, { trainerIds })),
    onSuccess: invalidate,
  });
}
