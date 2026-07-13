import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.mjs';

let ctx;
let SA;      // super admin
let A, B;    // admin tokens for two orgs
let orgAId, orgBId;
let batchAId;
before(async () => {
  ctx = await startTestServer();
  await ctx.mkUser('Super', 'super@x.local', 'super_admin');
  SA = await ctx.login('super@x.local');
  const a = await ctx.req('POST', '/organizations', SA, { name: 'Org A', code: 'ORGA', adminName: 'Admin A', adminEmail: 'a@a.local', adminPassword: 'Passw0rd!' });
  const b = await ctx.req('POST', '/organizations', SA, { name: 'Org B', code: 'ORGB', adminName: 'Admin B', adminEmail: 'b@b.local', adminPassword: 'Passw0rd!' });
  orgAId = a.data.id; orgBId = b.data.id;
  A = await ctx.login('a@a.local');
  B = await ctx.login('b@b.local');
});
after(async () => { await ctx.stop(); });

test('a batch created by org A is stamped with org A and invisible to org B', async () => {
  const { req, models } = ctx;
  const created = await req('POST', '/batches', A, { name: 'Batch A', code: 'BA1', startDate: '2026-01-01', endDate: '2027-01-01' });
  assert.equal(created.status, 201);
  batchAId = created.data.id;
  const doc = await models.Batch.findById(batchAId);
  assert.equal(doc.organization.toString(), orgAId, 'batch auto-stamped with creator org');

  const listA = await req('GET', '/batches', A);
  const listB = await req('GET', '/batches', B);
  assert.ok(listA.data.some((x) => x.id === batchAId), 'org A sees its batch');
  assert.ok(!listB.data.some((x) => x.id === batchAId), 'org B does NOT see org A batch');
});

test('org B cannot open org A batch by id (IDOR blocked → 404)', async () => {
  const { req } = ctx;
  assert.equal((await req('GET', `/batches/${batchAId}`, B)).status, 404);
  assert.equal((await req('GET', `/batches/${batchAId}`, A)).status, 200);
});

test('each org sees only its OWN curriculum modules', async () => {
  const { req } = ctx;
  const modsA = (await req('GET', '/modules', A)).data;
  const modsB = (await req('GET', '/modules', B)).data;
  assert.ok(modsA.length >= 10 && modsB.length >= 10, 'both orgs have their own modules');
  const idsA = new Set(modsA.map((m) => m.id));
  assert.ok(modsB.every((m) => !idsA.has(m.id)), 'no module id is shared across orgs');
});

test('super admin drills into an org via X-Org-Id and sees its data', async () => {
  // Full oversight: super admin selects org A (header) and acts as its admin.
  const res = await fetch(`${ctx.base}/batches`, { headers: { Authorization: `Bearer ${SA}`, 'X-Org-Id': orgAId } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(body.data.some((x) => x.id === batchAId), 'super admin sees org A batch when scoped to org A');
  // Scoped to org B, it should NOT see org A's batch.
  const resB = await fetch(`${ctx.base}/batches`, { headers: { Authorization: `Bearer ${SA}`, 'X-Org-Id': orgBId } });
  const bodyB = await resB.json();
  assert.ok(!bodyB.data.some((x) => x.id === batchAId), 'org-B view excludes org A batch');
});

test('users are org-scoped: org A admin cannot list org B users', async () => {
  const { req, models } = ctx;
  // Add a student to org B directly, stamped with org B.
  await models.User.create({ name: 'S-B', email: 'sb@b.local', role: 'student', organization: orgBId });
  const usersA = (await req('GET', '/users', A)).data.items;
  assert.ok(!usersA.some((u) => u.email === 'sb@b.local'), 'org A cannot see org B student');
  assert.ok(usersA.some((u) => u.email === 'a@a.local'), 'org A sees its own admin');
});
