import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './api';

/** Query keys for the module/curriculum domain. */
export const moduleKeys = {
  all: ['modules'],
  list: (opts) => ['modules', 'list', opts ?? {}],
  detail: (id) => ['modules', 'detail', id],
  trainers: ['users', 'trainers'],
};

// ── Queries ───────────────────────────────────────────────────────────────

export function useModules({ archived = false } = {}) {
  return useQuery({
    queryKey: moduleKeys.list({ archived }),
    queryFn: () =>
      unwrap(api.get('/modules', { params: archived ? { archived: 'true' } : {} })),
  });
}

export function useModule(id) {
  return useQuery({
    queryKey: moduleKeys.detail(id),
    queryFn: () => unwrap(api.get(`/modules/${id}`)),
    enabled: Boolean(id),
  });
}

/** Active trainers, for the admin "assign trainer" picker. */
export function useTrainers() {
  return useQuery({
    queryKey: moduleKeys.trainers,
    queryFn: async () => {
      const page = await unwrap(api.get('/users', { params: { role: 'trainer', pageSize: 100 } }));
      return page.items;
    },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────

/** Invalidate both the list and the affected detail after a write. */
function useModuleInvalidation() {
  const qc = useQueryClient();
  return (module) => {
    qc.invalidateQueries({ queryKey: moduleKeys.all });
    if (module?.id) qc.setQueryData(moduleKeys.detail(module.id), module);
  };
}

export function useCreateModule() {
  const invalidate = useModuleInvalidation();
  return useMutation({
    mutationFn: (body) => unwrap(api.post('/modules', body)),
    onSuccess: invalidate,
  });
}

/** Super admin: read-only preview of the master syllabus for a module (topics/subtopics). */
export function useMasterSyllabusPreview(id, enabled) {
  return useQuery({
    queryKey: ['module', id, 'master-syllabus-preview'],
    queryFn: () => unwrap(api.get(`/modules/${id}/master-syllabus-preview`)),
    enabled: Boolean(id && enabled),
  });
}

/** Super admin (drilled into an org): copy the master syllabus onto this org's module. */
export function useImportSyllabusFromMaster() {
  const invalidate = useModuleInvalidation();
  return useMutation({
    mutationFn: (id) => unwrap(api.post(`/modules/${id}/import-syllabus`)),
    onSuccess: invalidate,
  });
}

/** Org admin: request the master syllabus for a module (the super admin approves it). */
export function useRequestMasterSyllabus() {
  return useMutation({
    mutationFn: ({ id, note }) => unwrap(api.post(`/modules/${id}/master-syllabus-request`, note ? { note } : {})),
  });
}

/** Super admin: pending + decided master-syllabus import requests (with previews). */
export function useSyllabusRequests(enabled = true) {
  return useQuery({
    queryKey: ['syllabus-requests'],
    queryFn: () => unwrap(api.get('/modules/master-syllabus-requests')),
    enabled,
  });
}

/** Super admin: approve (apply) or reject a request. */
export function useDecideSyllabusRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }) => unwrap(api.patch(`/modules/master-syllabus-requests/${id}`, { decision, ...(note ? { note } : {}) })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['syllabus-requests'] }),
  });
}

export function useUpdateModule() {
  const invalidate = useModuleInvalidation();
  return useMutation({
    mutationFn: ({ id, ...body }) => unwrap(api.patch(`/modules/${id}`, body)),
    onSuccess: invalidate,
  });
}

export function useArchiveModule() {
  const invalidate = useModuleInvalidation();
  return useMutation({
    mutationFn: (id) => unwrap(api.delete(`/modules/${id}`)),
    onSuccess: invalidate,
  });
}

/** Permanently delete a module (server refuses if it's still referenced anywhere). */
export function useDeleteModule() {
  const invalidate = useModuleInvalidation();
  return useMutation({
    mutationFn: (id) => unwrap(api.delete(`/modules/${id}/permanent`)),
    onSuccess: invalidate,
  });
}

/** Bulk reorder — pass the full ordered array of module ids. */
export function useReorderModules() {
  const invalidate = useModuleInvalidation();
  return useMutation({
    mutationFn: (order) => unwrap(api.post('/modules/reorder', { order })),
    onSuccess: invalidate,
  });
}

export function useAssignTrainer() {
  const invalidate = useModuleInvalidation();
  return useMutation({
    mutationFn: ({ id, trainerId }) => unwrap(api.post(`/modules/${id}/trainers`, { trainerId })),
    onSuccess: invalidate,
  });
}

export function useRemoveTrainer() {
  const invalidate = useModuleInvalidation();
  return useMutation({
    mutationFn: ({ id, trainerId }) => unwrap(api.delete(`/modules/${id}/trainers/${trainerId}`)),
    onSuccess: invalidate,
  });
}

export function useAddTopic() {
  const invalidate = useModuleInvalidation();
  return useMutation({
    mutationFn: ({ id, ...body }) => unwrap(api.post(`/modules/${id}/topics`, body)),
    onSuccess: invalidate,
  });
}

export function useUpdateTopic() {
  const invalidate = useModuleInvalidation();
  return useMutation({
    mutationFn: ({ id, topicId, ...body }) =>
      unwrap(api.patch(`/modules/${id}/topics/${topicId}`, body)),
    onSuccess: invalidate,
  });
}

/** Bulk-import a syllabus (topics + subtopics) from a parsed spreadsheet. */
export function useImportSyllabus() {
  const invalidate = useModuleInvalidation();
  return useMutation({
    mutationFn: ({ id, topics }) => unwrap(api.post(`/modules/${id}/syllabus/import`, { topics })),
    onSuccess: (res) => invalidate(res?.module),
  });
}

export function useDeleteTopic() {
  const invalidate = useModuleInvalidation();
  return useMutation({
    mutationFn: ({ id, topicId }) => unwrap(api.delete(`/modules/${id}/topics/${topicId}`)),
    onSuccess: invalidate,
  });
}

export function useSetTopicCompletion() {
  const invalidate = useModuleInvalidation();
  return useMutation({
    mutationFn: ({ id, topicId, completed }) =>
      unwrap(api.patch(`/modules/${id}/topics/${topicId}/completion`, { completed })),
    onSuccess: invalidate,
  });
}

export function useUpdateObjectives() {
  const invalidate = useModuleInvalidation();
  return useMutation({
    mutationFn: ({ id, learningObjectives }) =>
      unwrap(api.patch(`/modules/${id}/objectives`, { learningObjectives })),
    onSuccess: invalidate,
  });
}
