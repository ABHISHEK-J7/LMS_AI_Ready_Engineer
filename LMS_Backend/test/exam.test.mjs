import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, iso } from './helpers.mjs';

let ctx;
let T;
let S;
let mod;
before(async () => {
  ctx = await startTestServer();
  const trainer = await ctx.mkUser('T', 't@x.local', 'trainer');
  const student = await ctx.mkUser('S', 's@x.local', 'student');
  mod = await ctx.models.Module.create({ name: 'M', code: 'EXAM', order: 1, assignedTrainers: [trainer._id], topics: [{ title: 'a', order: 0 }] });
  const batch = await ctx.models.Batch.create({ name: 'B', code: 'EXAMB', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'), students: [student._id], trainers: [trainer._id], modules: [mod._id] });
  student.batch = batch._id; await student.save();
  T = await ctx.login('t@x.local');
  S = await ctx.login('s@x.local');
});
after(async () => { await ctx.stop(); });

async function buildTimed(title, prepIndex, type = 'preparation') {
  const { req } = ctx;
  const bank = await req('POST', '/question-bank', T, { module: mod._id.toString(), type: 'mcq', prompt: 'Q', options: ['A', 'B'], correctOption: 0 });
  const a = await req('POST', '/assessments', T, { module: mod._id.toString(), title, type, ...(type === 'preparation' ? { prepIndex } : {}), proctoring: 'app', availableFrom: iso(-5), deadline: iso(240), durationMinutes: 60 });
  await req('POST', `/assessments/${a.data.id}/questions/from-bank`, T, { questionIds: [bank.data.id] });
  await req('POST', `/assessments/${a.data.id}/unlock`, T);
  return a.data;
}

test('proctored test: questions hidden until start, then revealed without the correct answer', async () => {
  const { req } = ctx;
  const prep = await buildTimed('Prep one', 1);
  const pre = await req('GET', `/assessments/${prep.id}`, S);
  assert.equal(pre.data.mustStart, true);
  assert.equal(pre.data.questions.length, 0);
  const started = await req('POST', `/assessments/${prep.id}/start`, S);
  assert.equal(started.status, 201);
  assert.equal(started.data.questions.length, 1);
  assert.equal(started.data.questions[0].correctOption, undefined);
});

test('final is gated until BOTH preparation tests are attempted', async () => {
  const { req } = ctx;
  // module already has Prep one (index 1) from the test above; add prep 2 + final.
  const p2 = await buildTimed('Prep two', 2);
  const bankF = await req('POST', '/question-bank', T, { module: mod._id.toString(), type: 'mcq', prompt: 'Q', options: ['A', 'B'], correctOption: 0 });
  const fin = await req('POST', '/assessments', T, { module: mod._id.toString(), title: 'Final', type: 'final', proctoring: 'none' });
  await req('POST', `/assessments/${fin.data.id}/questions/from-bank`, T, { questionIds: [bankF.data.id] });
  await req('POST', `/assessments/${fin.data.id}/unlock`, T);

  // Disqualify on prep 2 → must NOT count as attempted.
  await req('POST', `/assessments/${p2.id}/start`, S);
  await req('POST', `/assessments/${p2.id}/disqualify`, S, { reason: 'left' });
  assert.equal((await req('GET', `/assessments/${fin.data.id}`, S)).status, 403, 'disqualified prep should not satisfy the gate');
});
