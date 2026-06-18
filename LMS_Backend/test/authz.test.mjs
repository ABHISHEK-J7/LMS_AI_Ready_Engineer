import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.mjs';

let ctx;
before(async () => { ctx = await startTestServer(); });
after(async () => { await ctx.stop(); });

test('role guard: a student cannot list users (admin-only)', async () => {
  const { req, mkUser, login } = ctx;
  await mkUser('S', 's@x.local', 'student');
  const S = await login('s@x.local');
  assert.equal((await req('GET', '/users', S)).status, 403);
});

test('IDOR: a student cannot submit an assessment outside their batch', async () => {
  const { req, mkUser, login, models } = ctx;
  const trainer = await mkUser('T', 't2@x.local', 'trainer');
  const sA = await mkUser('A', 'a@x.local', 'student');
  await mkUser('B', 'b@x.local', 'student');
  const modB = await models.Module.create({ name: 'MB', code: 'IDORB', order: 1, assignedTrainers: [trainer._id] });
  const batchA = await models.Batch.create({ name: 'BA', code: 'IDORA', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'), students: [sA._id], trainers: [trainer._id], modules: [] });
  sA.batch = batchA._id; await sA.save();
  const T = await login('t2@x.local');
  const bank = await req('POST', '/question-bank', T, { module: modB._id.toString(), type: 'mcq', prompt: 'Q', options: ['A', 'B'], correctOption: 0 });
  const prep = await req('POST', '/assessments', T, { module: modB._id.toString(), title: 'Prep B', type: 'preparation', prepIndex: 1, proctoring: 'none' });
  await req('POST', `/assessments/${prep.data.id}/questions/from-bank`, T, { questionIds: [bank.data.id] });
  await req('POST', `/assessments/${prep.data.id}/unlock`, T);
  const SA = await login('a@x.local');
  assert.equal((await req('POST', `/assessments/${prep.data.id}/submit`, SA, { answers: [] })).status, 403);
});

test('trainer-scoping: a trainer cannot read a student outside their batches', async () => {
  const { req, mkUser, login, models } = ctx;
  const tA = await mkUser('TA', 'ta@x.local', 'trainer');
  const sB = await mkUser('SB', 'sbx@x.local', 'student');
  const batchB = await models.Batch.create({ name: 'BB', code: 'SCOPEB', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'), students: [sB._id], trainers: [], modules: [] });
  sB.batch = batchB._id; await sB.save();
  const TA = await login('ta@x.local');
  assert.equal((await req('GET', `/progress/student/${sB._id}`, TA)).status, 403);
});

test('refresh token is revoked after logout', async () => {
  const { req, mkUser } = ctx;
  await mkUser('R', 'r@x.local', 'student');
  const lr = await req('POST', '/auth/login', null, { email: 'r@x.local', password: 'Passw0rd!' });
  await req('POST', '/auth/logout', lr.tokens.accessToken);
  assert.equal((await req('POST', '/auth/refresh', null, { refreshToken: lr.tokens.refreshToken })).status, 401);
});
