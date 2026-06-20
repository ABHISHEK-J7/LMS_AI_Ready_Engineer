import { AssessmentType } from '@/shared';

/** Preparation + final are proctored, timed exams. */
export const isProctoredType = (type) => type === AssessmentType.PREPARATION || type === AssessmentType.FINAL;

/** Combine a date (yyyy-mm-dd) + time (HH:mm) in the browser's timezone → ISO instant. */
export function combineDateTime(date, time) {
  if (!date || !time) return undefined;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Validate the exam window for a proctored ('app'/'seb') test. Requires a date,
 * window start + end, and a positive duration, and the close time must be after
 * the open time. Returns an error string, or '' when the window is valid.
 */
export function validateExamWindow({ examDate, windowStart, windowEnd, durationMinutes }) {
  if (!examDate || !windowStart || !windowEnd) {
    return 'Set the test date and both window open/close times for a proctored exam.';
  }
  if (!durationMinutes || Number(durationMinutes) <= 0) {
    return 'Set a duration (minutes per student) of at least 1.';
  }
  const start = combineDateTime(examDate, windowStart);
  const end = combineDateTime(examDate, windowEnd);
  if (!start || !end) return 'The exam date or window times are invalid.';
  if (new Date(end) <= new Date(start)) {
    return 'The window must close after it opens.';
  }
  return '';
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
