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

test('any number of trainers can be assigned to a module (n trainers)', async () => {
  const { req, models } = ctx;
  const trainers = await models.User.insertMany(
    Array.from({ length: 5 }, (_, i) => ({ name: `Multi ${i}`, email: `multi${i}@x.local`, role: 'trainer', status: 'active' })),
  );
  const ids = trainers.map((t) => String(t._id));
  const mod = await models.Module.create({ name: 'MTn', code: 'MTMODN', order: 3, topics: [] });
  const batch = await models.Batch.create({
    name: 'MBn', code: 'MTBATCHN', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'),
    students: [], modules: [mod._id], moduleTrainers: [{ module: mod._id, trainers: [] }],
  });

  // Append one at a time, exactly like the UI adds them.
  let res;
  for (let i = 0; i < ids.length; i += 1) {
    res = await req('PUT', `/batches/${batch._id}/modules/${mod._id}/trainers`, A, { trainerIds: ids.slice(0, i + 1) });
    assert.equal(res.status, 200);
  }
  const mt = res.data.moduleTrainers.find((x) => String(x.module?.id ?? x.module) === String(mod._id));
  assert.equal(mt.trainers.length, 5, 'all five trainers assigned to the module');
  assert.deepEqual(mt.trainers.map((t) => t.id).sort(), [...ids].sort());
});

test('one trainer can deliver multiple modules in a batch', async () => {
  const { req, models } = ctx;
  const tr = await models.User.create({ name: 'Shared', email: 'shared@x.local', role: 'trainer', status: 'active' });
  const [modA, modB] = await models.Module.insertMany([
    { name: 'MA', code: 'MTMODA', order: 4, topics: [] },
    { name: 'MB', code: 'MTMODB', order: 5, topics: [] },
  ]);
  const batch = await models.Batch.create({
    name: 'MBx', code: 'MTBATCHX', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'),
    students: [], modules: [modA._id, modB._id],
    moduleTrainers: [{ module: modA._id, trainers: [] }, { module: modB._id, trainers: [] }],
  });

  assert.equal((await req('PUT', `/batches/${batch._id}/modules/${modA._id}/trainers`, A, { trainerIds: [String(tr._id)] })).status, 200);
  const res = await req('PUT', `/batches/${batch._id}/modules/${modB._id}/trainers`, A, { trainerIds: [String(tr._id)] });
  assert.equal(res.status, 200);
  for (const mid of [modA._id, modB._id]) {
    const mt = res.data.moduleTrainers.find((x) => String(x.module?.id ?? x.module) === String(mid));
    assert.equal(mt.trainers.length, 1, 'trainer present on both modules');
    assert.equal(mt.trainers[0].id, String(tr._id));
  }
});
