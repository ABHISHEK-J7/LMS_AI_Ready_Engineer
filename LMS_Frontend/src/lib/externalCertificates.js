import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './api';

const KEY = ['external-certificates'];

/** The signed-in student's own external (non-AIRE) certificates. */
export function useMyExternalCertificates() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => unwrap(api.get('/external-certificates')),
  });
}

/** Add an external certificate — pass either { title, issuer, url } or a FormData
 *  (title, issuer, file) for an uploaded PDF/image. */
export function useAddExternalCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      unwrap(
        payload instanceof FormData
          ? api.post('/external-certificates', payload, { headers: { 'Content-Type': 'multipart/form-data' } })
          : api.post('/external-certificates', payload),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteExternalCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => unwrap(api.delete(`/external-certificates/${id}`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
