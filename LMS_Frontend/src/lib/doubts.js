import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './api';

export const doubtKeys = {
  all: ['doubts'],
  list: (filters) => ['doubts', 'list', filters ?? {}],
  detail: (id) => ['doubts', 'detail', id],
};

export function useDoubts(filters = {}) {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  return useQuery({
    queryKey: doubtKeys.list(params),
    queryFn: () => unwrap(api.get('/doubts', { params })),
    refetchInterval: 60_000, // keep new-message counts fresh
  });
}

export function useDoubt(id) {
  return useQuery({
    queryKey: doubtKeys.detail(id),
    queryFn: () => unwrap(api.get(`/doubts/${id}`)),
    enabled: Boolean(id),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return (doubt) => {
    qc.invalidateQueries({ queryKey: doubtKeys.all });
    if (doubt?.id) qc.setQueryData(doubtKeys.detail(doubt.id), doubt);
  };
}

export function useCreateDoubt() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body) => unwrap(api.post('/doubts', body)), onSuccess: invalidate });
}

export function useReplyDoubt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }) => unwrap(api.post(`/doubts/${id}/replies`, { body })),
    onSuccess: invalidate,
  });
}

/** Student resolves their doubt; the rating (1–5) is optional. */
export function useCloseDoubt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, rating }) => unwrap(api.post(`/doubts/${id}/close`, rating != null ? { rating } : {})),
    onSuccess: invalidate,
  });
}

/** Student rates a doubt at any time (incl. after it auto-closed unrated). */
export function useRateDoubt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, rating }) => unwrap(api.post(`/doubts/${id}/rate`, { rating })),
    onSuccess: invalidate,
  });
}

/** Trainer scoreboard — doubts answered/cleared + average rating. */
export function useMyDoubtStats(enabled = true) {
  return useQuery({
    queryKey: ['doubts', 'my-stats'],
    queryFn: () => unwrap(api.get('/doubts/my-stats')),
    enabled,
  });
}

// Track when the user last viewed the Doubts tab — powers the sidebar count.
const DOUBTS_SEEN_KEY = 'lms.doubtsSeenAt';
export function getDoubtsSeenAt() {
  return Number(localStorage.getItem(DOUBTS_SEEN_KEY) || 0);
}
export function markDoubtsSeen() {
  localStorage.setItem(DOUBTS_SEEN_KEY, String(Date.now()));
}

// Per-doubt "last read" timestamps — powers the per-card new-message count.
const DOUBT_READS_KEY = 'lms.doubtReads';
function getReads() {
  try {
    return JSON.parse(localStorage.getItem(DOUBT_READS_KEY) || '{}');
  } catch {
    return {};
  }
}
export function getDoubtReadAt(id) {
  return Number(getReads()[id] || 0);
}
export function markDoubtRead(id) {
  const reads = getReads();
  reads[id] = Date.now();
  localStorage.setItem(DOUBT_READS_KEY, JSON.stringify(reads));
}

/** Count messages in a doubt that arrived from someone OTHER than `userId`
 *  since the user last opened it. */
export function newMessageCount(doubt, userId) {
  const readAt = getDoubtReadAt(doubt.id);
  return (doubt.messages ?? []).filter((m) => {
    const authorId = m.author?.id ?? m.author;
    return new Date(m.createdAt).getTime() > readAt && authorId !== userId;
  }).length;
}
