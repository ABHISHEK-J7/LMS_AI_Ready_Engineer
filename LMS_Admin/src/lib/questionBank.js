import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './api';

export const bankKeys = {
  all: ['question-bank'],
  list: (filters) => ['question-bank', 'list', filters ?? {}],
};

/** All bank questions for a module (filter client-side by topic). */
export function useQuestionBank(filters = {}) {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  return useQuery({
    queryKey: bankKeys.list(params),
    queryFn: () => unwrap(api.get('/question-bank', { params })),
    enabled: Boolean(params.module),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: bankKeys.all });
}

export function useAddBankQuestion() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body) => unwrap(api.post('/question-bank', body)), onSuccess: invalidate });
}
export function useBulkAddBankQuestions() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body) => unwrap(api.post('/question-bank/bulk', body)), onSuccess: invalidate });
}
export function useUpdateBankQuestion() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ id, ...body }) => unwrap(api.patch(`/question-bank/${id}`, body)), onSuccess: invalidate });
}
export function useDeleteBankQuestion() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id) => unwrap(api.delete(`/question-bank/${id}`)), onSuccess: invalidate });
}
