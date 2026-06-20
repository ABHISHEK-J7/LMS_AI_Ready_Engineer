// LiveKit must be configured BEFORE the app's env module loads.
process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';
process.env.LIVEKIT_API_KEY = 'devkey';
process.env.LIVEKIT_API_SECRET = 'devsecret-devsecret-devsecret-1234567890';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.mjs';

let ctx;
let T; // owning trainer
let S; // enrolled student
let O; // outsider student (not in batch)
let admin;
let liveClass;

before(async () => {
  ctx = await startTestServer();
  const trainer = await ctx.mkUser('Trainer', 't@x.local', 'trainer');
  const student = await ctx.mkUser('Sam', 's@x.local', 'student');
  const outsider = await ctx.mkUser('Otto', 'o@x.local', 'student');
  await ctx.mkUser('Admin', 'admin@x.local', 'admin');
  const mod = await ctx.models.Module.create({ name: 'M', code: 'LIVE', order: 1, assignedTrainers: [trainer._id] });
  const batch = await ctx.models.Batch.create({ name: 'B', code: 'LIVEB', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'), students: [student._id], trainers: [trainer._id], modules: [mod._id] });
  student.batch = batch._id; await student.save();
  liveClass = await ctx.models.ClassSchedule.create({
    title: 'Intro to Prompting (Live)', module: mod._id, batch: batch._id, trainer: trainer._id,
    date: new Date('2026-06-20'), startTime: '10:00', endTime: '11:00', provider: 'internal',
  });
  T = await ctx.login('t@x.local');
  S = await ctx.login('s@x.local');
  O = await ctx.login('o@x.local');
  admin = await ctx.login('admin@x.local');
});
after(async () => { await ctx.stop(); });

const looksLikeJwt = (s) => typeof s === 'string' && s.split('.').length === 3;

test('owning trainer gets a host token', async () => {
  const res = await ctx.req('POST', `/classes/${liveClass._id}/live-token`, T);
  assert.equal(res.status, 200);
  assert.equal(res.data.host, true);
  assert.equal(res.data.url, 'wss://test.livekit.cloud');
  assert.ok(looksLikeJwt(res.data.token), 'token should be a JWT');
  assert.match(res.data.classTitle, /Intro to Prompting/);
});

test('enrolled student gets a participant (non-host) token', async () => {
  const res = await ctx.req('POST', `/classes/${liveClass._id}/live-token`, S);
  assert.equal(res.status, 200);
  assert.equal(res.data.host, false);
  assert.ok(looksLikeJwt(res.data.token));
});

test('admin joins any class as host', async () => {
  const res = await ctx.req('POST', `/classes/${liveClass._id}/live-token`, admin);
  assert.equal(res.status, 200);
  assert.equal(res.data.host, true);
});

test('a student not in the batch is refused', async () => {
  const res = await ctx.req('POST', `/classes/${liveClass._id}/live-token`, O);
  assert.equal(res.status, 403);
});

test('an unauthenticated request is refused', async () => {
  const res = await ctx.req('POST', `/classes/${liveClass._id}/live-token`, null);
  assert.equal(res.status, 401);
});
