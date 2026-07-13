import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.mjs';

let ctx;
let SA; // super admin token
before(async () => {
  ctx = await startTestServer();
  await ctx.mkUser('Super', 'super@x.local', 'super_admin'); // organization stays null
  SA = await ctx.login('super@x.local');
});
after(async () => { await ctx.stop(); });

test('super admin creates an organization, seeded with its own curriculum + a first admin', async () => {
  const { req, models } = ctx;
  const res = await req('POST', '/organizations', SA, {
    name: 'Acme Institute', code: 'acme',
    adminName: 'Acme Admin', adminEmail: 'admin@acme.local', adminPassword: 'Passw0rd!',
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.code, 'ACME');
  assert.ok(res.data.admin, 'first admin returned');
  assert.equal(res.data.admin.role, 'admin');

  // Its own copy of the curriculum was seeded.
  const orgId = res.data.id;
  const modules = await models.Module.countDocuments({ organization: orgId });
  assert.ok(modules >= 10, `org has its own modules (got ${modules})`);

  // The admin belongs to the org and can log in.
  const login = await req('POST', '/auth/login', null, { email: 'admin@acme.local', password: 'Passw0rd!' });
  assert.ok(login.tokens?.accessToken, 'org admin can log in');
  const admin = await models.User.findOne({ email: 'admin@acme.local' });
  assert.equal(admin.organization.toString(), orgId);
});

test('a second organization gets a SEPARATE curriculum copy (per-org isolation)', async () => {
  const { req, models } = ctx;
  const res = await req('POST', '/organizations', SA, { name: 'Beta Corp', code: 'BETA' });
  assert.equal(res.status, 201);
  const betaModules = await models.Module.find({ organization: res.data.id }).select('code');
  assert.ok(betaModules.length >= 10, 'beta has its own modules');
  // Same codes can coexist across orgs (per-org unique, not global).
  assert.ok(betaModules.some((m) => m.code === 'PE'), 'code PE exists in beta too');
});

test('a regular admin cannot access the super-admin organization APIs', async () => {
  const { req } = ctx;
  await ctx.mkUser('Reg', 'reg@x.local', 'admin');
  const A = await ctx.login('reg@x.local');
  assert.equal((await req('GET', '/organizations', A)).status, 403);
  assert.equal((await req('POST', '/organizations', A, { name: 'X', code: 'X1' })).status, 403);
});

test('super admin overview returns global counts', async () => {
  const { req } = ctx;
  const o = await req('GET', '/organizations/overview', SA);
  assert.equal(o.status, 200);
  assert.ok(o.data.organizations >= 2, 'counts organizations');
  assert.ok(typeof o.data.students === 'number' && typeof o.data.modules === 'number');
});

test('deleting an organization cascades: removes the org AND all its data', async () => {
  const { req, models } = ctx;
  // A throwaway org with an admin + a student + a batch.
  const org = await req('POST', '/organizations', SA, { name: 'Doomed', code: 'DOOM', adminName: 'Doom Admin', adminEmail: 'da@doom.local', adminPassword: 'Passw0rd!' });
  const orgId = org.data.id;
  const DA = await ctx.login('da@doom.local');
  await req('POST', '/batches', DA, { name: 'B', code: 'DB1', startDate: '2026-01-01', endDate: '2027-01-01' });
  await models.User.create({ name: 'St', email: 'st@doom.local', role: 'student', organization: orgId });

  assert.ok(await models.User.countDocuments({ organization: orgId }) >= 2);
  assert.ok(await models.Module.countDocuments({ organization: orgId }) >= 10);

  const res = await req('DELETE', `/organizations/${orgId}`, SA);
  assert.equal(res.status, 200);
  assert.equal(await models.Organization.findById(orgId), null, 'org gone');
  assert.equal(await models.User.countDocuments({ organization: orgId }), 0, 'users gone');
  assert.equal(await models.Module.countDocuments({ organization: orgId }), 0, 'modules gone');
  assert.equal(await models.Batch.countDocuments({ organization: orgId }), 0, 'batches gone');
});

test('super admin adds another admin to an existing org', async () => {
  const { req, models } = ctx;
  const org = await req('POST', '/organizations', SA, { name: 'Gamma', code: 'GAMMA' });
  const add = await req('POST', `/organizations/${org.data.id}/admins`, SA, {
    name: 'Gamma Admin 2', email: 'admin2@gamma.local', password: 'Passw0rd!',
  });
  assert.equal(add.status, 201);
  const admins = await models.User.countDocuments({ organization: org.data.id, role: 'admin' });
  assert.equal(admins, 1);
});
