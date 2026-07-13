import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.mjs';

// Regression: attendance is saved via Attendance.bulkWrite, which bypasses the
// tenant plugin. Without an explicit org stamp the records are org-less and the
// (org-scoped) batch report can't see them — attendance silently vanishes.
let ctx, SA;
before(async () => {
  ctx = await startTestServer();
  await ctx.mkUser('Super', 'super@x.local', 'super_admin');
  SA = await ctx.login('super@x.local');
});
after(async () => { await ctx.stop(); });

test('org-scoped attendance save persists and shows up in the batch report', async () => {
  const { req } = ctx;
  await req('POST', '/organizations', SA, { name: 'Att Co', code: 'ATTCO', adminName: 'Att Admin', adminEmail: 'admin@attco.local', adminPassword: 'Passw0rd!' });
  const A = await ctx.login('admin@attco.local');

  const tr = await req('POST', '/users', A, { name: 'Tr', email: 'tr@attco.local', password: 'Passw0rd!', role: 'trainer' });
  const s1 = await req('POST', '/users', A, { name: 'S1', email: 's1@attco.local', password: 'Passw0rd!', role: 'student' });
  const s2 = await req('POST', '/users', A, { name: 'S2', email: 's2@attco.local', password: 'Passw0rd!', role: 'student' });

  const batch = await req('POST', '/batches', A, { name: 'Batch B', code: 'ATB', startDate: '2026-01-01', endDate: '2027-01-01' });
  await req('POST', `/batches/${batch.data.id}/students`, A, { ids: [s1.data.id, s2.data.id] });

  const mods = await req('GET', '/modules', A);
  const cls = await req('POST', '/classes', A, {
    title: 'Class C', module: mods.data[0].id, batch: batch.data.id, trainer: tr.data.id,
    date: '2026-06-12', startTime: '09:30', endTime: '11:00', provider: 'ms_teams',
  });
  assert.equal(cls.status, 201);

  const save = await req('POST', `/attendance/class/${cls.data.id}`, A, {
    bufferMinutes: 15,
    records: [
      { student: s1.data.id, status: 'present' },
      { student: s2.data.id, status: 'absent' },
    ],
  });
  assert.equal(save.status, 200);
  assert.equal(save.data.saved, 2, 'both records saved (not lost to a null org)');
  assert.equal(save.data.summary.attended, 1);

  // The class remembers the grace window.
  const roster = await req('GET', `/attendance/class/${cls.data.id}`, A);
  assert.equal(roster.data.class.bufferMinutes, 15);
  assert.equal(roster.data.class.attendanceMarked, true);

  // The org-scoped batch report reflects the saved statuses.
  const report = await req('GET', `/attendance/batch/${batch.data.id}`, A);
  const byId = Object.fromEntries(report.data.students.map((s) => [s.student.id, s]));
  assert.equal(byId[s1.data.id].percentage, 100);
  assert.equal(byId[s2.data.id].percentage, 0);
  assert.equal(byId[s1.data.id].byStatus.present, 1);
  assert.equal(byId[s2.data.id].byStatus.absent, 1);
});
