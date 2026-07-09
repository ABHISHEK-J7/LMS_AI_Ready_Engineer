import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.mjs';

let ctx;
let A;
let modId;
let topicId;
before(async () => {
  ctx = await startTestServer();
  await ctx.mkUser('Admin', 'admin@x.local', 'admin');
  const m = await ctx.models.Module.create({ name: 'M', code: 'RESA', order: 1, topics: [{ title: 'a', order: 0 }] });
  modId = m._id.toString();
  topicId = m.topics[0]._id.toString();
  A = await ctx.login('admin@x.local');
});
after(async () => { await ctx.stop(); });

test('an article is created from markdown content (no file/url)', async () => {
  const { req } = ctx;
  const r = await req('POST', '/resources', A, {
    module: modId, topic: topicId, type: 'article', title: 'Primer', content: '# Hello\n\n**bold** text.',
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.type, 'article');
  assert.equal(r.data.content, '# Hello\n\n**bold** text.');
  assert.equal(r.data.url, '', 'articles carry no url');
});

test('an article with no content is rejected', async () => {
  const { req } = ctx;
  const r = await req('POST', '/resources', A, { module: modId, topic: topicId, type: 'article', title: 'Empty', content: '   ' });
  assert.equal(r.status, 400);
});

test('an article can be edited; other types cannot be PATCHed', async () => {
  const { req } = ctx;
  const created = await req('POST', '/resources', A, { module: modId, topic: topicId, type: 'article', title: 'Editable', content: 'v1' });
  const upd = await req('PATCH', `/resources/${created.data.id}`, A, { content: 'v2 updated' });
  assert.equal(upd.status, 200);
  assert.equal(upd.data.content, 'v2 updated');

  const link = await req('POST', '/resources', A, { module: modId, topic: topicId, type: 'link', title: 'Ext', url: 'https://example.com' });
  assert.equal(link.status, 201);
  const bad = await req('PATCH', `/resources/${link.data.id}`, A, { title: 'x' });
  assert.equal(bad.status, 400, 'only articles are editable');
});

test('a link resource still works alongside articles', async () => {
  const { req } = ctx;
  const r = await req('POST', '/resources', A, { module: modId, topic: topicId, type: 'link', title: 'Docs', url: 'https://example.com/x' });
  assert.equal(r.status, 201);
  assert.equal(r.data.url, 'https://example.com/x');
});
