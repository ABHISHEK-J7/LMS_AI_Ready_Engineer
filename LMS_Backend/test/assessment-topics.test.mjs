import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { startTestServer } from './helpers.mjs';

let ctx, ADMIN, T, mod, batch, topicIds;
before(async () => {
  ctx = await startTestServer();
  await ctx.mkUser('Admin', 'admin@x.local', 'admin');
  ADMIN = await ctx.login('admin@x.local');
  const trainer = await ctx.mkUser('T', 't@x.local', 'trainer');
  const student = await ctx.mkUser('S', 's@x.local', 'student');
  mod = await ctx.models.Module.create({
    name: 'M', code: 'TOPIC', order: 1, assignedTrainers: [trainer._id],
    topics: [{ title: 'Embeddings', order: 0 }, { title: 'RAG', order: 1 }, { title: 'Agents', order: 2 }],
  });
  topicIds = mod.topics.map((t) => String(t._id));
  batch = await ctx.models.Batch.create({
    name: 'B', code: 'TOPICB', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'),
    students: [student._id], trainers: [trainer._id], modules: [mod._id],
    moduleTrainers: [{ module: mod._id, trainers: [trainer._id] }],
  });
  T = await ctx.login('t@x.local');
});
after(async () => { await ctx.stop(); });

test('a ready-made test stores the selected module topics (multiple)', async () => {
  const res = await ctx.req('POST', '/assessments', ADMIN, {
    module: String(mod._id), title: 'Covers two topics', type: 'practice', proctoring: 'none',
    topics: [topicIds[0], topicIds[1]],
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.topics.length, 2);
  assert.deepEqual(res.data.topics.map((t) => t.title), ['Embeddings', 'RAG']);
});

test('topics preserve the module order regardless of input order', async () => {
  const res = await ctx.req('POST', '/assessments', ADMIN, {
    module: String(mod._id), title: 'Order test', type: 'practice', proctoring: 'none',
    topics: [topicIds[2], topicIds[0]], // Agents, Embeddings — out of order
  });
  assert.equal(res.status, 201);
  assert.deepEqual(res.data.topics.map((t) => t.title), ['Embeddings', 'Agents']);
});

test('a topic id not in the module is rejected', async () => {
  const res = await ctx.req('POST', '/assessments', ADMIN, {
    module: String(mod._id), title: 'Bad topic', type: 'practice', proctoring: 'none',
    topics: [String(new mongoose.Types.ObjectId())],
  });
  assert.equal(res.status, 400);
});

test('assigning a template copies its topics onto the batch instance', async () => {
  const tmpl = await ctx.req('POST', '/assessments', ADMIN, {
    module: String(mod._id), title: 'To assign', type: 'practice', proctoring: 'none',
    topics: [topicIds[0], topicIds[2]],
  });
  // Needs a question to be assignable.
  const q = await ctx.models.QuestionBankItem.create({ module: mod._id, type: 'mcq', prompt: 'Q?', options: ['a', 'b'], correctOption: 0 });
  await ctx.req('POST', `/assessments/${tmpl.data.id}/questions/from-bank`, ADMIN, { questionIds: [String(q._id)] });

  const asg = await ctx.req('POST', `/assessments/${tmpl.data.id}/assign`, T, { batch: String(batch._id) });
  assert.equal(asg.status, 201);
  assert.equal(asg.data.isTemplate, false);
  assert.deepEqual(asg.data.topics.map((t) => t.title), ['Embeddings', 'Agents']);
});
