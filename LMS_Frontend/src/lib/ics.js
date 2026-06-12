/**
 * Build a downloadable iCalendar (.ics) file from class sessions so students and
 * trainers can subscribe to their timetable in Google/Apple/Outlook calendars.
 * Times are emitted as local "floating" times (no timezone) for simplicity.
 */

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Combine an ISO date + "HH:mm" into an iCal local datetime (YYYYMMDDTHHMMSS). */
function icsDateTime(isoDate, hhmm) {
  const d = new Date(isoDate);
  const [h, m] = (hhmm || '00:00').split(':');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(Number(h))}${pad(Number(m))}00`;
}

function escapeText(s = '') {
  return String(s).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
}

export function classesToIcs(classes = []) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AI Ready Engineer//LMS//EN',
    'CALSCALE:GREGORIAN',
  ];
  for (const c of classes) {
    if (c.status === 'cancelled') continue;
    const desc = [c.module?.name, c.batch?.name, c.trainer?.name].filter(Boolean).join(' · ');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${c.id}@aiready`,
      `SUMMARY:${escapeText(c.title)}`,
      `DTSTART:${icsDateTime(c.date, c.startTime)}`,
      `DTEND:${icsDateTime(c.date, c.endTime)}`,
      `DESCRIPTION:${escapeText(desc)}`,
    );
    if (c.meetingLink) {
      lines.push(`LOCATION:${escapeText(c.meetingLink)}`, `URL:${escapeText(c.meetingLink)}`);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** Trigger a browser download of the timetable as an .ics file. */
export function downloadIcs(filename, classes) {
  const blob = new Blob([classesToIcs(classes)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
