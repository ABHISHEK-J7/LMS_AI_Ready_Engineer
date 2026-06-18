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

/** Tone for an attendance percentage relative to the min threshold. */
export function pctTone(pct, min = 75) {
  if (pct >= min) return 'success';
  if (pct >= min - 15) return 'warning';
  return 'error';
}
