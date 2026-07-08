import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.mjs';

let ctx;
let A;
before(async () => {
  ctx = await startTestServer();
  await ctx.mkUser('Admin', 'admin@x.local', 'admin');
  A = await ctx.login('admin@x.local');
});
after(async () => { await ctx.stop(); });

test('permanent delete is refused while a batch still has students', async () => {
  const { req, models } = ctx;
  const s = await models.User.create({ name: 'S', email: 'bs@x.local', role: 'student', status: 'active' });
  const batch = await models.Batch.create({ name: 'B', code: 'BDEL1', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'), students: [s._id] });
  const res = await req('DELETE', `/batches/${batch._id}/permanent`, A);
  assert.equal(res.status, 409, 'blocked while it has students');
  assert.ok(await models.Batch.findById(batch._id), 'batch still exists');
});

test('permanent delete is refused while an assigned test references the batch', async () => {
  const { req, models } = ctx;
  const batch = await models.Batch.create({ name: 'B2', code: 'BDEL2', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'), students: [] });
  const mod = await models.Module.create({ name: 'M', code: 'BDMOD', order: 1, topics: [] });
  await models.Assessment.create({ title: 'T', module: mod._id, batch: batch._id, type: 'final', questions: [] });
  const res = await req('DELETE', `/batches/${batch._id}/permanent`, A);
  assert.equal(res.status, 409, 'blocked while an assigned test references it');
});

test('an empty, unreferenced batch is permanently deleted', async () => {
  const { req, models } = ctx;
  const batch = await models.Batch.create({ name: 'B3', code: 'BDEL3', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'), students: [] });
  const res = await req('DELETE', `/batches/${batch._id}/permanent`, A);
  assert.equal(res.status, 200);
  assert.equal(await models.Batch.findById(batch._id), null, 'batch is gone');
});

test('only an admin can permanently delete a batch', async () => {
  const { req, models } = ctx;
  await ctx.mkUser('Tr', 'tr@x.local', 'trainer');
  const T = await ctx.login('tr@x.local');
  const batch = await models.Batch.create({ name: 'B4', code: 'BDEL4', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'), students: [] });
  assert.equal((await req('DELETE', `/batches/${batch._id}/permanent`, T)).status, 403);
});
