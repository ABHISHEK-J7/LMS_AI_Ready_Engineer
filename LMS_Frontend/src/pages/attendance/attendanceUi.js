import { AttendanceStatus } from '@/shared';

export const ATT_LABEL = {
  [AttendanceStatus.PRESENT]: 'Present',
  [AttendanceStatus.ABSENT]: 'Absent',
  [AttendanceStatus.LATE]: 'Late',
  [AttendanceStatus.EXCUSED]: 'Excused',
};

export const ATT_TONE = {
  [AttendanceStatus.PRESENT]: 'success',
  [AttendanceStatus.ABSENT]: 'error',
  [AttendanceStatus.LATE]: 'warning',
  [AttendanceStatus.EXCUSED]: 'neutral',
};

export const ATT_OPTIONS = Object.values(AttendanceStatus).map((v) => ({ value: v, label: ATT_LABEL[v] }));

/** Absolute ms of the class start (its calendar day at startTime, local time). */
export function classStartMs(classDate, startTime) {
  const day = new Date(classDate).toISOString().slice(0, 10); // YYYY-MM-DD
  return new Date(`${day}T${startTime || '00:00'}:00`).getTime();
}

/**
 * Automated attendance from the student's entry time:
 *   no entry             → Absent
 *   entry ≤ start+buffer → Present (on time)
 *   entry >  start+buffer → Late
 */
export function autoStatus(joinedAt, classDate, startTime, bufferMinutes) {
  if (!joinedAt) return AttendanceStatus.ABSENT;
  const cutoff = classStartMs(classDate, startTime) + (Number(bufferMinutes) || 0) * 60000;
  return new Date(joinedAt).getTime() <= cutoff ? AttendanceStatus.PRESENT : AttendanceStatus.LATE;
}

/** "On time" reads better than "Present" for a buffer-derived status. */
export const AUTO_LABEL = {
  [AttendanceStatus.PRESENT]: 'On time',
  [AttendanceStatus.LATE]: 'Late',
  [AttendanceStatus.ABSENT]: 'Absent',
};

/** Summarize a set of attendance records (mirrors the backend computeSummary).
 *  attended = present + late; excused is excluded from the % denominator. */
export function summarize(records = []) {
  const byStatus = {
    [AttendanceStatus.PRESENT]: 0,
    [AttendanceStatus.ABSENT]: 0,
    [AttendanceStatus.LATE]: 0,
    [AttendanceStatus.EXCUSED]: 0,
  };
  for (const r of records) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const totalClasses = records.length;
  const attended = byStatus[AttendanceStatus.PRESENT] + byStatus[AttendanceStatus.LATE];
  const denom = totalClasses - byStatus[AttendanceStatus.EXCUSED];
  const percentage = denom > 0 ? Math.round((attended / denom) * 100) : 0;
  return { totalClasses, attended, percentage, byStatus };
}

/** Tone for an attendance percentage relative to the min threshold. */
export function pctTone(pct, min = 75) {
  if (pct >= min) return 'success';
  if (pct >= min - 15) return 'warning';
  return 'error';
}
