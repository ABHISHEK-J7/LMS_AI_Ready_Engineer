import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.mjs';

let ctx;
let admin;
let T; // assigned trainer
let U; // unassigned trainer
let S; // student
let mod;

before(async () => {
  ctx = await startTestServer();
  const trainer = await ctx.mkUser('Trainer', 't@x.local', 'trainer');
  await ctx.mkUser('Other', 'u@x.local', 'trainer');
  await ctx.mkUser('Sam', 's@x.local', 'student');
  await ctx.mkUser('Admin', 'admin@x.local', 'admin');
  mod = await ctx.models.Module.create({ name: 'M', code: 'SYL', order: 1, assignedTrainers: [trainer._id] });
  admin = await ctx.login('admin@x.local');
  T = await ctx.login('t@x.local');
  U = await ctx.login('u@x.local');
  S = await ctx.login('s@x.local');
});
after(async () => { await ctx.stop(); });

const payload = {
  topics: [
    { title: 'Generative AI', subtopics: [{ title: 'What is GenAI', description: 'Overview' }, { description: 'Prompting' }] },
    { title: 'RAG', subtopics: [{ title: 'Embeddings', description: 'Vectors' }] },
  ],
};

test('assigned trainer imports a syllabus with subtopics', async () => {
  const res = await ctx.req('POST', `/modules/${mod._id}/syllabus/import`, T, payload);
  assert.equal(res.status, 200);
  assert.equal(res.data.added, 2);
  assert.equal(res.data.updated, 0);
  const gen = res.data.module.topics.find((t) => t.title === 'Generative AI');
  assert.equal(gen.subtopics.length, 2);
  assert.equal(gen.subtopics[0].title, 'What is GenAI');
  assert.equal(gen.subtopics[1].description, 'Prompting');
});

test('re-importing a topic by name replaces its subtopics (update, not duplicate)', async () => {
  const res = await ctx.req('POST', `/modules/${mod._id}/syllabus/import`, admin, {
    topics: [{ title: 'generative ai', subtopics: [{ title: 'Only one', description: 'now' }] }],
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.updated, 1);
  assert.equal(res.data.added, 0);
  const topics = res.data.module.topics.filter((t) => t.title.toLowerCase() === 'generative ai');
  assert.equal(topics.length, 1, 'no duplicate topic');
  assert.equal(topics[0].subtopics.length, 1);
});

test('a topic can be edited to set subtopics directly', async () => {
  const m = await ctx.models.Module.findById(mod._id);
  const ragId = m.topics.find((t) => t.title === 'RAG').id;
  const res = await ctx.req('PATCH', `/modules/${mod._id}/topics/${ragId}`, T, {
    subtopics: [{ title: 'Chunking', description: 'split docs' }, { title: 'Retrieval', description: 'top-k' }],
  });
  assert.equal(res.status, 200);
  const rag = res.data.topics.find((t) => t.id === ragId);
  assert.equal(rag.subtopics.length, 2);
  assert.equal(rag.subtopics[1].title, 'Retrieval');
});

test('subtopics persist From/To dates, and blank dates clear cleanly', async () => {
  const m = await ctx.models.Module.findById(mod._id);
  const ragId = m.topics.find((t) => t.title === 'RAG').id;
  const res = await ctx.req('PATCH', `/modules/${mod._id}/topics/${ragId}`, T, {
    subtopics: [
      { title: 'Embeddings', description: 'vectors', fromDate: '2026-06-01', toDate: '2026-06-03' },
      { title: 'Retrieval', description: 'top-k', fromDate: '', toDate: null },
    ],
  });
  assert.equal(res.status, 200);
  const rag = res.data.topics.find((t) => t.id === ragId);
  assert.equal(rag.subtopics[0].fromDate.slice(0, 10), '2026-06-01');
  assert.equal(rag.subtopics[0].toDate.slice(0, 10), '2026-06-03');
  assert.equal(rag.subtopics[1].fromDate, null);
  assert.equal(rag.subtopics[1].toDate, null);
});

test('an unassigned trainer cannot import', async () => {
  assert.equal((await ctx.req('POST', `/modules/${mod._id}/syllabus/import`, U, payload)).status, 403);
});

test('a student cannot import (staff-only route)', async () => {
  assert.equal((await ctx.req('POST', `/modules/${mod._id}/syllabus/import`, S, payload)).status, 403);
});
