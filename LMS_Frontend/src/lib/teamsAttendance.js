import * as XLSX from 'xlsx';

// Parse a Microsoft Teams attendance export (or any sheet with an email column and
// a join-time column) into { email → earliest join time-of-day (minutes) }. Teams
// exports a multi-section sheet, so we scan for the participants header row rather
// than assuming a fixed layout.

const norm = (h) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

/** Find the header row + the email/join columns in an array-of-arrays sheet. */
function findColumns(rows) {
  const scan = (test) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] ?? [];
      let emailCol = -1;
      let joinCol = -1;
      row.forEach((cell, c) => {
        const k = norm(cell);
        if (emailCol < 0 && test.email(k)) emailCol = c;
        if (joinCol < 0 && test.join(k)) joinCol = c;
      });
      if (emailCol >= 0 && joinCol >= 0) return { headerRow: i, emailCol, joinCol };
    }
    return null;
  };
  // Prefer precise Teams headers, then fall back to looser matches.
  return (
    scan({
      email: (k) => k === 'email' || k === 'upn' || k === 'userprincipalname' || k.includes('email'),
      join: (k) => k.includes('firstjoin') || k.includes('jointime') || k.includes('timejoined') || k.includes('joinedat') || k.includes('firstjoined'),
    }) ||
    scan({ email: (k) => k.includes('email') || k.includes('mail'), join: (k) => k.includes('join') })
  );
}

/** Extract the time-of-day (minutes since midnight) from a Teams join-time cell. */
export function parseTimeOfDay(val) {
  if (val instanceof Date && !Number.isNaN(val.getTime())) return val.getHours() * 60 + val.getMinutes();
  const s = String(val ?? '').trim();
  if (!s) return null;
  // 12-hour "10:03:15 AM"
  let m = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp])[Mm]/);
  if (m) { let h = Number(m[1]) % 12; if (/p/i.test(m[3])) h += 12; return h * 60 + Number(m[2]); }
  // 24-hour "10:03" (possibly inside a datetime)
  m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
  return null;
}

/** "HH:MM" → minutes since midnight. */
export function startMinutesOf(startTime) {
  const m = String(startTime ?? '').match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/**
 * Grade a single join against the class start + grace window:
 *   no join → 'absent', joined within grace → 'present', later → 'late'.
 */
export function classifyJoin(joinMinutes, startMinutes, bufferMinutes) {
  if (joinMinutes == null) return 'absent';
  return joinMinutes <= startMinutes + bufferMinutes ? 'present' : 'late';
}

/**
 * @param {ArrayBuffer} arrayBuffer  the uploaded .xlsx/.csv
 * @returns {{ byEmail: Map<string, number>, participants: number }}
 */
export function parseTeamsAttendance(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  const cols = findColumns(rows);
  if (!cols) throw new Error('Could not find an Email column and a Join-time column in that file.');

  const byEmail = new Map();
  for (let i = cols.headerRow + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const emailMatch = String(row[cols.emailCol] ?? '').match(EMAIL_RE);
    if (!emailMatch) continue; // section breaks / blanks
    const email = emailMatch[0].toLowerCase();
    const join = parseTimeOfDay(row[cols.joinCol]);
    if (join == null) continue;
    // A participant may appear on several rows — keep their earliest join.
    if (!byEmail.has(email) || join < byEmail.get(email)) byEmail.set(email, join);
  }
  if (byEmail.size === 0) throw new Error('No participant rows with an email and join time were found.');
  return { byEmail, participants: byEmail.size };
}
