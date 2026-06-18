import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.mjs';

let ctx;
let admin;
let T;
let S;
let student;
let mod;
let batch;
let assessment;

before(async () => {
  ctx = await startTestServer();
  const trainer = await ctx.mkUser('Trainer', 't@x.local', 'trainer');
  student = await ctx.mkUser('Sam Student', 's@x.local', 'student', { phone: '555-1234', bio: 'hello' });
  await ctx.mkUser('Admin', 'admin@x.local', 'admin');
  mod = await ctx.models.Module.create({ name: 'M', code: 'GDPR', order: 1, assignedTrainers: [trainer._id] });
  batch = await ctx.models.Batch.create({ name: 'B', code: 'GDPRB', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'), students: [student._id], trainers: [trainer._id], modules: [mod._id] });
  student.batch = batch._id; await student.save();
  trainer.assignedModules = [mod._id]; trainer.assignedBatches = [batch._id]; await trainer.save();
  assessment = await ctx.models.Assessment.create({ title: 'Practice 1', module: mod._id, type: 'practice', practiceIndex: 1 });
  await ctx.models.Submission.create({ assessment: assessment._id, student: student._id, status: 'graded', score: 88, passed: true, submittedAt: new Date(), warnings: 1 });
  admin = await ctx.login('admin@x.local');
  T = await ctx.login('t@x.local');
  S = await ctx.login('s@x.local');
});
after(async () => { await ctx.stop(); });

// ── GDPR export ────────────────────────────────────────────────────────────────

test('a signed-in user can export their own data bundle', async () => {
  const res = await ctx.req('GET', '/profile/export', S);
  assert.equal(res.status, 200);
  assert.equal(res.data.profile.email, 's@x.local');
  assert.equal(res.data.profile.name, 'Sam Student');
  assert.ok(Array.isArray(res.data.submissions));
  assert.equal(res.data.submissions.length, 1);
  assert.equal(res.data.submissions[0].score, 88);
  // Secrets must never be in the export.
  assert.equal(res.data.profile.passwordHash, undefined);
});

test('export requires authentication', async () => {
  assert.equal((await ctx.req('GET', '/profile/export', null)).status, 401);
});

// ── GDPR erasure (admin) ─────────────────────────────────────────────────────────

test('admin erase anonymizes the user and revokes their tokens', async () => {
  const res = await ctx.req('POST', `/users/${student._id}/erase`, admin);
  assert.equal(res.status, 200);
  assert.equal(res.data.erased, true);

  const after = await ctx.models.User.findById(student._id);
  assert.equal(after.name, 'Deleted user');
  assert.match(after.email, /^deleted-.*@deleted\.invalid$/);
  assert.equal(after.phone, undefined);
  assert.equal(after.status, 'archived');

  // De-identified academic records are preserved.
  assert.equal(await ctx.models.Submission.countDocuments({ student: student._id }), 1);
});

test('erase is admin-only', async () => {
  assert.equal((await ctx.req('POST', `/users/${student._id}/erase`, T)).status, 403);
  assert.equal((await ctx.req('POST', `/users/${student._id}/erase`, S)).status, 403);
});

// ── CSV exports ───────────────────────────────────────────────────────────────

async function getRaw(path, token) {
  const res = await fetch(ctx.base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: res.status, contentType: res.headers.get('content-type'), text: await res.text() };
}

test('submissions CSV export returns a text/csv attachment with a header row', async () => {
  const res = await getRaw(`/assessments/${assessment._id}/submissions.csv`, admin);
  assert.equal(res.status, 200);
  assert.match(res.contentType, /text\/csv/);
  const firstLine = res.text.replace(/^﻿/, '').split('\r\n')[0];
  assert.match(firstLine, /Student,Email,Status,Score/);
  assert.match(res.text, /88/);
});

test('batch attendance CSV export returns a text/csv attachment', async () => {
  const res = await getRaw(`/attendance/batch/${batch._id}/export.csv`, admin);
  assert.equal(res.status, 200);
  assert.match(res.contentType, /text\/csv/);
  assert.match(res.text.replace(/^﻿/, ''), /Student,Email,Total Classes/);
});

// ── Proctor-snapshot retention ───────────────────────────────────────────────────

test('retention sweep clears proctor snapshots older than the cutoff', async () => {
  const { purgeOldProctorShots } = await import('../src/services/examMaintenance.js');
  // A fresh attempt (should be kept) and a stale one (should be purged).
  const fresh = await ctx.models.Submission.create({ assessment: assessment._id, student: (await ctx.mkUser('U1', 'u1@x.local', 'student'))._id, proctorShots: ['/api/uploads/fresh.jpg'], submittedAt: new Date() });
  const stale = await ctx.models.Submission.create({ assessment: assessment._id, student: (await ctx.mkUser('U2', 'u2@x.local', 'student'))._id, proctorShots: ['/api/uploads/stale.jpg'], submittedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) });

  const cleared = await purgeOldProctorShots();
  assert.ok(cleared >= 1);
  assert.deepEqual((await ctx.models.Submission.findById(stale._id)).proctorShots, []);
  assert.deepEqual((await ctx.models.Submission.findById(fresh._id)).proctorShots, ['/api/uploads/fresh.jpg']);
});
