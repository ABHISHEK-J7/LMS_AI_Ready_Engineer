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

test('a scenario question never leaks its correctOption or referenceAnswer to the student', async () => {
  const { req } = ctx;
  // Author a Scenario Based question WITH a private grading rubric.
  const bank = await req('POST', '/question-bank', T, {
    module: mod._id.toString(),
    type: 'scenario',
    prompt: 'A user reports the model is hallucinating. How do you respond?',
    referenceAnswer: 'SECRET RUBRIC: mention grounding, retrieval, and evaluation.',
  });
  assert.equal(bank.data.referenceAnswer, 'SECRET RUBRIC: mention grounding, retrieval, and evaluation.');

  const a = await req('POST', '/assessments', T, {
    module: mod._id.toString(), title: 'Scenario prep', type: 'preparation',
    proctoring: 'app', availableFrom: iso(-5), deadline: iso(240), durationMinutes: 60,
  });
  await req('POST', `/assessments/${a.data.id}/questions/from-bank`, T, { questionIds: [bank.data.id] });
  await req('POST', `/assessments/${a.data.id}/unlock`, T);

  const started = await req('POST', `/assessments/${a.data.id}/start`, S);
  assert.equal(started.status, 201);
  const q = started.data.questions[0];
  assert.equal(q.type, 'scenario');
  assert.equal(q.correctOption, undefined, 'correctOption must be stripped');
  assert.equal(q.referenceAnswer, undefined, 'private grading rubric must NEVER reach the student');
});

test('batch + allow-list scoping: only assigned students in the batch see the assessment', async () => {
  const { req, models } = ctx;
  const trainerId = mod.assignedTrainers[0];
  const a1 = await ctx.mkUser('A1', 'a1@x.local', 'student');
  const b1 = await ctx.mkUser('B1', 'b1@x.local', 'student');
  const m2 = await models.Module.create({ name: 'M2', code: 'EXAM2', order: 2, assignedTrainers: [trainerId], topics: [{ title: 'a', order: 0 }] });
  const batch2 = await models.Batch.create({ name: 'B2', code: 'EXB2', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'), students: [a1._id, b1._id], trainers: [trainerId], modules: [m2._id] });
  a1.batch = batch2._id; await a1.save();
  b1.batch = batch2._id; await b1.save();
  const A1 = await ctx.login('a1@x.local');
  const B1 = await ctx.login('b1@x.local');

  const bank = await req('POST', '/question-bank', T, { module: m2._id.toString(), type: 'mcq', prompt: 'Q', options: ['A', 'B'], correctOption: 0 });
  const created = await req('POST', '/assessments', T, { module: m2._id.toString(), batch: batch2._id.toString(), title: 'Scoped practice', type: 'practice', proctoring: 'none' });
  await req('POST', `/assessments/${created.data.id}/questions/from-bank`, T, { questionIds: [bank.data.id] });
  // Restrict to A1 only.
  await req('PATCH', `/assessments/${created.data.id}/allowed-students`, T, { studentIds: [a1._id.toString()] });
  await req('POST', `/assessments/${created.data.id}/unlock`, T);

  const listA = await req('GET', '/assessments', A1);
  const listB = await req('GET', '/assessments', B1);
  assert.ok(listA.data.some((x) => x.id === created.data.id), 'allowed student A1 sees it');
  assert.ok(!listB.data.some((x) => x.id === created.data.id), 'non-allowed student B1 does NOT see it');
  assert.equal((await req('GET', `/assessments/${created.data.id}`, B1)).status, 403, 'B1 is blocked from opening it');
  assert.equal((await req('GET', `/assessments/${created.data.id}`, A1)).status, 200, 'A1 can open it');

  // Clearing the allow-list opens it to the whole batch → B1 now sees it.
  await req('PATCH', `/assessments/${created.data.id}/allowed-students`, T, { studentIds: [] });
  const listB2 = await req('GET', '/assessments', B1);
  assert.ok(listB2.data.some((x) => x.id === created.data.id), 'empty allow-list = whole batch can see it');
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
