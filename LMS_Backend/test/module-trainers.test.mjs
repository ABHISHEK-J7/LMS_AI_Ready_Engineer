import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { startTestServer } from './helpers.mjs';

let ctx, A;
before(async () => {
  ctx = await startTestServer();
  await ctx.mkUser('Admin', 'admin@x.local', 'admin');
  A = await ctx.login('admin@x.local');
});
after(async () => { await ctx.stop(); });

test('a batch drops an unresolvable trainer ref instead of serializing null', async () => {
  const { req, models } = ctx;
  const tr = await models.User.create({ name: 'Real Trainer', email: 'rt@x.local', role: 'trainer', status: 'active' });
  const mod = await models.Module.create({ name: 'MT', code: 'MTMOD', order: 1, topics: [] });
  const ghost = new mongoose.Types.ObjectId(); // never a real user (e.g. an erased account)

  const batch = await models.Batch.create({
    name: 'MB', code: 'MTBATCH', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'),
    students: [], modules: [mod._id],
    moduleTrainers: [{ module: mod._id, trainers: [tr._id, ghost] }],
    trainers: [tr._id, ghost],
  });

  const res = await req('GET', `/batches/${batch._id}`, A);
  assert.equal(res.status, 200);

  const mt = res.data.moduleTrainers.find((x) => String(x.module?.id ?? x.module) === String(mod._id));
  assert.ok(mt, 'module mapping present');
  assert.ok(mt.trainers.every(Boolean), 'no null trainer in the module mapping');
  assert.equal(mt.trainers.length, 1, 'only the resolvable trainer remains');
  assert.equal(mt.trainers[0].id, String(tr._id));
  assert.ok((res.data.trainers ?? []).every(Boolean), 'no null in derived trainers');
});

test('setting module trainers with clean ids still works', async () => {
  const { req, models } = ctx;
  const tr = await models.User.create({ name: 'T2', email: 't2@x.local', role: 'trainer', status: 'active' });
  const mod = await models.Module.create({ name: 'MT2', code: 'MTMOD2', order: 2, topics: [] });
  const batch = await models.Batch.create({
    name: 'MB2', code: 'MTBATCH2', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'),
    students: [], modules: [mod._id], moduleTrainers: [{ module: mod._id, trainers: [] }],
  });

  const res = await req('PUT', `/batches/${batch._id}/modules/${mod._id}/trainers`, A, { trainerIds: [String(tr._id)] });
  assert.equal(res.status, 200);
  const mt = res.data.moduleTrainers.find((x) => String(x.module?.id ?? x.module) === String(mod._id));
  assert.equal(mt.trainers.length, 1);
  assert.equal(mt.trainers[0].id, String(tr._id));
});
