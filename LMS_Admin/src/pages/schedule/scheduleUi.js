import { ClassStatus, MeetingProvider } from '@/shared';

export const STATUS_TONE = {
  [ClassStatus.SCHEDULED]: 'primary',
  [ClassStatus.IN_PROGRESS]: 'warning',
  [ClassStatus.COMPLETED]: 'success',
  [ClassStatus.CANCELLED]: 'error',
};

export const STATUS_LABEL = {
  [ClassStatus.SCHEDULED]: 'Scheduled',
  [ClassStatus.IN_PROGRESS]: 'In progress',
  [ClassStatus.COMPLETED]: 'Completed',
  [ClassStatus.CANCELLED]: 'Cancelled',
};

export const STATUS_OPTIONS = Object.values(ClassStatus).map((v) => ({
  value: v,
  label: STATUS_LABEL[v],
}));

export const PROVIDER_LABEL = {
  [MeetingProvider.INTERNAL]: 'In-app live class',
  [MeetingProvider.ZOOM]: 'Zoom',
  [MeetingProvider.GOOGLE_MEET]: 'Google Meet',
  [MeetingProvider.MS_TEAMS]: 'Microsoft Teams',
  [MeetingProvider.OTHER]: 'Other',
};

export const PROVIDER_OPTIONS = Object.values(MeetingProvider).map((v) => ({
  value: v,
  label: PROVIDER_LABEL[v],
}));

/** Group classes into [{ key, label, items }] ordered by day. */
export function groupByDay(classes = []) {
  const groups = new Map();
  for (const c of classes) {
    const key = new Date(c.date).toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => ({
      key,
      label: new Date(key).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      items,
    }));
}

/** Today at local midnight as an ISO date (YYYY-MM-DD) for "upcoming" filtering. */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
