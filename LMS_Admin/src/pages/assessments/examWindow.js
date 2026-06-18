import { AssessmentType } from '@/shared';

/** Preparation + final are proctored, timed exams. */
export const isProctoredType = (type) => type === AssessmentType.PREPARATION || type === AssessmentType.FINAL;

/** Combine a date (yyyy-mm-dd) + time (HH:mm) in the browser's timezone → ISO instant. */
export function combineDateTime(date, time) {
  if (!date || !time) return undefined;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Split an ISO instant into local { date, time } for date/time inputs. */
export function splitDateTime(iso) {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
