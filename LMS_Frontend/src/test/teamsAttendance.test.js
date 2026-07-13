import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseTeamsAttendance, joinCellToMs, classStartMs, classifyJoin } from '../lib/teamsAttendance.js';

function sheetBuffer(aoa) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

// Local wall-clock ms for a given day + time (matches how the app grades).
const at = (day, time) => new Date(`${day}T${time}:00`).getTime();

describe('classStartMs', () => {
  it('builds the class start as an absolute local datetime', () => {
    expect(classStartMs('2026-06-12', '09:30')).toBe(at('2026-06-12', '09:30'));
  });
  it('accepts a Date/ISO class date and uses its calendar day', () => {
    expect(classStartMs('2026-06-12T00:00:00.000Z', '09:30')).toBe(at('2026-06-12', '09:30'));
  });
});

describe('joinCellToMs', () => {
  it('parses a full datetime (uses its own date)', () => {
    expect(joinCellToMs('6/12/2026, 9:28:00 AM')).toBe(at('2026-06-12', '09:28'));
    expect(joinCellToMs('2026-06-12 09:41')).toBe(at('2026-06-12', '09:41'));
  });
  it('places a time-only cell on the class day', () => {
    expect(joinCellToMs('9:28 AM', '2026-06-12')).toBe(at('2026-06-12', '09:28'));
  });
  it('returns null for junk', () => {
    expect(joinCellToMs('', '2026-06-12')).toBeNull();
    expect(joinCellToMs('n/a', '2026-06-12')).toBeNull();
  });
});

describe('classifyJoin (full-datetime)', () => {
  const start = classStartMs('2026-06-12', '09:30');
  it('absent when there is no join', () => {
    expect(classifyJoin(null, start, 10)).toBe('absent');
  });
  it('present within the grace window (inclusive) and for early joins', () => {
    expect(classifyJoin(at('2026-06-12', '09:20'), start, 10)).toBe('present');
    expect(classifyJoin(at('2026-06-12', '09:40'), start, 10)).toBe('present'); // exactly at cutoff
  });
  it('late after the grace window', () => {
    expect(classifyJoin(at('2026-06-12', '09:41'), start, 10)).toBe('late');
  });
  it('a join on a different day is graded by the real moment (very late)', () => {
    // Same time-of-day but the day after → far beyond the grace window.
    expect(classifyJoin(at('2026-06-13', '09:31'), start, 10)).toBe('late');
  });
});

describe('parseTeamsAttendance', () => {
  it('reads emails + earliest full-datetime join from a Teams-style export', () => {
    const buf = sheetBuffer([
      ['1. Summary'],
      ['Meeting title', 'AI Class'],
      [''],
      ['2. Participants'],
      ['Name', 'First Join', 'Last Leave', 'Email', 'Role'],
      ['Alice Anderson', '6/12/2026, 9:28:00 AM', '6/12/2026, 11:00 AM', 'alice@x.com', 'Presenter'],
      ['Bob Brown', '6/12/2026, 9:41:00 AM', '6/12/2026, 11:00 AM', 'bob@x.com', 'Attendee'],
      // A participant logged twice — the earlier join should win.
      ['Bob Brown', '6/12/2026, 9:35:00 AM', '6/12/2026, 9:39 AM', 'bob@x.com', 'Attendee'],
    ]);
    const { byEmail, participants } = parseTeamsAttendance(buf, '2026-06-12');
    expect(participants).toBe(2);
    expect(byEmail.get('alice@x.com')).toBe(at('2026-06-12', '09:28'));
    expect(byEmail.get('bob@x.com')).toBe(at('2026-06-12', '09:35')); // earliest of the two

    const start = classStartMs('2026-06-12', '09:30');
    expect(classifyJoin(byEmail.get('alice@x.com'), start, 10)).toBe('present'); // 9:28
    expect(classifyJoin(byEmail.get('bob@x.com'), start, 10)).toBe('present');   // 9:35 ≤ 9:40
    expect(classifyJoin(byEmail.get('bob@x.com'), start, 3)).toBe('late');       // 9:35 > 9:33
    expect(classifyJoin(byEmail.get('nobody@x.com') ?? null, start, 10)).toBe('absent');
  });

  it('throws when no email/join columns are present', () => {
    const buf = sheetBuffer([['Foo', 'Bar'], ['1', '2']]);
    expect(() => parseTeamsAttendance(buf, '2026-06-12')).toThrow();
  });
});
