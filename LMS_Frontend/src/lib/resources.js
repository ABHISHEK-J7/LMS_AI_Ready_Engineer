import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './api';

export const resourceKeys = {
  forModule: (moduleId) => ['resources', moduleId],
};

export function useResources(moduleId) {
  return useQuery({
    queryKey: resourceKeys.forModule(moduleId),
    queryFn: () => unwrap(api.get('/resources', { params: { module: moduleId } })),
    enabled: Boolean(moduleId),
  });
}

export function useAddResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ module, type, title, topic, url, file }) => {
      const fd = new FormData();
      fd.append('module', module);
      fd.append('type', type);
      fd.append('title', title);
      if (topic) fd.append('topic', topic);
      if (url) fd.append('url', url);
      if (file) fd.append('file', file);
      // Content-Type undefined lets axios set multipart/form-data + boundary.
      return unwrap(api.post('/resources', fd, { headers: { 'Content-Type': undefined } }));
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: resourceKeys.forModule(vars.module) }),
  });
}

export function useDeleteResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => unwrap(api.delete(`/resources/${id}`)),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: resourceKeys.forModule(vars.module) }),
  });
}
