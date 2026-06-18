import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.mjs';

let ctx;
let T;
let S;
let mod;
let batch;
before(async () => {
  ctx = await startTestServer();
  const trainer = await ctx.mkUser('T', 't@x.local', 'trainer');
  const student = await ctx.mkUser('S', 's@x.local', 'student');
  mod = await ctx.models.Module.create({ name: 'M', code: 'PROG', order: 1, assignedTrainers: [trainer._id], topics: [{ title: 'a', order: 0 }] });
  batch = await ctx.models.Batch.create({ name: 'B', code: 'PROGB', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'), students: [student._id], trainers: [trainer._id], modules: [mod._id] });
  student.batch = batch._id; await student.save();
  T = await ctx.login('t@x.local');
  S = await ctx.login('s@x.local');
});
after(async () => { await ctx.stop(); });

test('module does not advance before the trainer completes the syllabus', async () => {
  const prog = (await ctx.req('GET', '/progress/me', S)).data;
  assert.equal(prog.modules[0].completed, false);
});

test('module advances once all topics are marked taught (regardless of the final)', async () => {
  const { req } = ctx;
  await req('PUT', `/batches/${batch._id}/modules/${mod._id}/topics/${mod.topics[0]._id}`, T, { taught: true });
  const prog = (await req('GET', '/progress/me', S)).data;
  assert.equal(prog.modules[0].syllabusComplete, true);
  assert.equal(prog.modules[0].completed, true);
  assert.equal(prog.modules[0].passed, false, 'advancing without passing the final is NOT mastery');
});
