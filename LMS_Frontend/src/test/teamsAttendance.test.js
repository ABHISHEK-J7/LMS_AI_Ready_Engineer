import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseTeamsAttendance, parseTimeOfDay, startMinutesOf, classifyJoin } from '../lib/teamsAttendance.js';

function sheetBuffer(aoa) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

describe('parseTimeOfDay', () => {
  it('parses 12-hour times', () => {
    expect(parseTimeOfDay('10:03:15 AM')).toBe(10 * 60 + 3);
    expect(parseTimeOfDay('1:05 PM')).toBe(13 * 60 + 5);
    expect(parseTimeOfDay('12:00 AM')).toBe(0);
    expect(parseTimeOfDay('12:30 PM')).toBe(12 * 60 + 30);
  });
  it('parses 24-hour and datetime strings', () => {
    expect(parseTimeOfDay('09:30')).toBe(9 * 60 + 30);
    expect(parseTimeOfDay('6/12/2025, 9:28:00 AM')).toBe(9 * 60 + 28);
  });
  it('returns null for junk', () => {
    expect(parseTimeOfDay('')).toBeNull();
    expect(parseTimeOfDay('n/a')).toBeNull();
  });
});

describe('startMinutesOf', () => {
  it('converts HH:MM to minutes', () => {
    expect(startMinutesOf('09:30')).toBe(570);
    expect(startMinutesOf('00:00')).toBe(0);
  });
});

describe('classifyJoin', () => {
  const start = startMinutesOf('09:30'); // 570
  it('absent when there is no join', () => {
    expect(classifyJoin(null, start, 10)).toBe('absent');
  });
  it('present within the grace window (inclusive), including early joins', () => {
    expect(classifyJoin(560, start, 10)).toBe('present'); // joined early
    expect(classifyJoin(580, start, 10)).toBe('present'); // exactly at the cutoff
  });
  it('late after the grace window', () => {
    expect(classifyJoin(581, start, 10)).toBe('late');
  });
});

describe('parseTeamsAttendance', () => {
  it('reads emails + earliest join from a multi-section Teams-style export', () => {
    const buf = sheetBuffer([
      ['1. Summary'],
      ['Meeting title', 'AI Class'],
      [''],
      ['2. Participants'],
      ['Name', 'First Join', 'Last Leave', 'Email', 'Role'],
      ['Alice Anderson', '6/12/2025, 9:28:00 AM', '6/12/2025, 11:00 AM', 'alice@x.com', 'Presenter'],
      ['Bob Brown', '6/12/2025, 9:41:00 AM', '6/12/2025, 11:00 AM', 'bob@x.com', 'Attendee'],
      // A participant logged twice — the earlier join should win.
      ['Bob Brown', '6/12/2025, 9:35:00 AM', '6/12/2025, 9:39 AM', 'bob@x.com', 'Attendee'],
    ]);
    const { byEmail, participants } = parseTeamsAttendance(buf);
    expect(participants).toBe(2);
    expect(byEmail.get('alice@x.com')).toBe(9 * 60 + 28);
    expect(byEmail.get('bob@x.com')).toBe(9 * 60 + 35); // earliest of the two rows

    // Grade against a 9:30 start with a 10-minute grace window.
    const start = startMinutesOf('09:30');
    expect(classifyJoin(byEmail.get('alice@x.com'), start, 10)).toBe('present'); // 9:28
    expect(classifyJoin(byEmail.get('bob@x.com'), start, 10)).toBe('present');   // 9:35 ≤ 9:40
    expect(classifyJoin(byEmail.get('bob@x.com'), start, 3)).toBe('late');       // 9:35 > 9:33
    expect(classifyJoin(byEmail.get('nobody@x.com') ?? null, start, 10)).toBe('absent');
  });

  it('throws when no email/join columns are present', () => {
    const buf = sheetBuffer([['Foo', 'Bar'], ['1', '2']]);
    expect(() => parseTeamsAttendance(buf)).toThrow();
  });
});
