import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.mjs';

let ctx;
let A; // admin token
before(async () => {
  ctx = await startTestServer();
  await ctx.mkUser('Admin', 'admin@x.local', 'admin');
  A = await ctx.login('admin@x.local');
});
after(async () => { await ctx.stop(); });

test('permanent delete is refused while a batch still references the module', async () => {
  const { req, models } = ctx;
  const mod = await models.Module.create({ name: 'Del1', code: 'DEL1', order: 1, topics: [] });
  await models.Batch.create({ name: 'B', code: 'DELB', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'), modules: [mod._id] });

  const res = await req('DELETE', `/modules/${mod._id}/permanent`, A);
  assert.equal(res.status, 409, 'delete blocked while referenced');
  assert.ok(await models.Module.findById(mod._id), 'module still exists');
});

test('permanent delete removes an unreferenced module and its question bank', async () => {
  const { req, models } = ctx;
  const mod = await models.Module.create({ name: 'Del2', code: 'DEL2', order: 2, topics: [] });
  await models.QuestionBankItem.create({ module: mod._id, type: 'mcq', prompt: 'Q', options: ['A', 'B'], correctOption: 0 });

  const res = await req('DELETE', `/modules/${mod._id}/permanent`, A);
  assert.equal(res.status, 200);
  assert.equal(await models.Module.findById(mod._id), null, 'module is gone');
  assert.equal(await models.QuestionBankItem.countDocuments({ module: mod._id }), 0, 'its bank items are gone');
});

test('reorder assigns 1-based order by array position', async () => {
  const { req, models } = ctx;
  const m1 = await models.Module.create({ name: 'R1', code: 'RE1', order: 10, topics: [] });
  const m2 = await models.Module.create({ name: 'R2', code: 'RE2', order: 11, topics: [] });
  // Put m2 before m1.
  const res = await req('POST', '/modules/reorder', A, { order: [m2._id.toString(), m1._id.toString()] });
  assert.equal(res.status, 200);
  assert.equal((await models.Module.findById(m2._id)).order, 1);
  assert.equal((await models.Module.findById(m1._id)).order, 2);
});
