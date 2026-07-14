import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.mjs';

let ctx;
before(async () => {
  ctx = await startTestServer();
  await ctx.mkUser('Admin', 'admin@x.local', 'admin');
  await ctx.mkUser('Trainer', 'tr@x.local', 'trainer');
  await ctx.mkUser('Student', 'stud@x.local', 'student');
});
after(async () => { await ctx.stop(); });

test('admin analytics returns the enriched shape', async () => {
  const A = await ctx.login('admin@x.local');
  const res = await ctx.req('GET', '/analytics/admin', A);
  assert.equal(res.status, 200);
  const d = res.data;
  assert.ok(d.counts && typeof d.counts.students === 'number' && typeof d.counts.assessments === 'number');
  assert.ok(d.attendanceDistribution && 'present' in d.attendanceDistribution && 'absent' in d.attendanceDistribution);
  assert.ok(d.assessments?.overall && typeof d.assessments.overall.passRate === 'number');
  assert.ok(d.assessments.byType && 'final' in d.assessments.byType);
  assert.ok(Array.isArray(d.funnel) && d.funnel.length === 4);
  assert.ok(Array.isArray(d.certificatesTrend) && d.certificatesTrend.length === 8);
  assert.ok(Array.isArray(d.batchPerformance));
  assert.ok(d.doubtStats && typeof d.doubtStats.resolutionRate === 'number');
});

test('trainer analytics returns counts, assessments, and a leaderboard', async () => {
  const T = await ctx.login('tr@x.local');
  const res = await ctx.req('GET', '/analytics/trainer', T);
  assert.equal(res.status, 200);
  assert.ok(res.data.counts && typeof res.data.counts.modules === 'number');
  assert.ok(Array.isArray(res.data.assessments));
  assert.ok(Array.isArray(res.data.leaderboard));
});

test('student analytics returns progress, attendance, scores, and module status', async () => {
  const Sk = await ctx.login('stud@x.local');
  const res = await ctx.req('GET', '/analytics/student', Sk);
  assert.equal(res.status, 200);
  const d = res.data;
  assert.ok(d.progress && typeof d.progress.total === 'number');
  assert.ok(d.attendance && typeof d.attendance.percentage === 'number');
  assert.ok(d.statusCounts && 'completed' in d.statusCounts);
  assert.ok(d.scoreSummary && typeof d.scoreSummary.avgScore === 'number');
  assert.ok(Array.isArray(d.scores) && Array.isArray(d.moduleStatus));
  assert.ok(typeof d.certificates === 'number' && typeof d.upcomingClasses === 'number');
});

test('a student cannot hit admin analytics (role-gated)', async () => {
  const Sk = await ctx.login('stud@x.local');
  assert.equal((await ctx.req('GET', '/analytics/admin', Sk)).status, 403);
});
