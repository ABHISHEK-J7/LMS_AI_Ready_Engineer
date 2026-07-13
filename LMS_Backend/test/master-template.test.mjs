import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.mjs';

let ctx;
let SA; // super admin token
let template; // the reserved master-template org

before(async () => {
  ctx = await startTestServer();
  await ctx.mkUser('Super', 'super@x.local', 'super_admin'); // organization stays null
  SA = await ctx.login('super@x.local');

  // Set up the reserved master-template org with a DISTINCTIVE module the built-in
  // default curriculum does not contain, so we can prove cloning (not the fallback).
  template = await ctx.models.Organization.create({ name: 'Master Template', code: 'TEMPLATE', isTemplate: true });
  await ctx.models.Module.create({
    organization: template._id,
    name: 'Custom Master Module', code: 'ZZ', order: 99, level: 'advanced',
    topics: [{ title: 'Master Topic', order: 0, completed: false }],
  });
});
after(async () => { await ctx.stop(); });

test('a new org clones the master template curriculum (not the built-in default)', async () => {
  const { req, models } = ctx;
  const res = await req('POST', '/organizations', SA, { name: 'Clone Co', code: 'CLONE' });
  assert.equal(res.status, 201);
  const orgId = res.data.id;

  const mods = await models.Module.find({ organization: orgId }).select('code name');
  assert.equal(mods.length, 1, 'cloned exactly the template (one module), not the default set');
  assert.equal(mods[0].code, 'ZZ');
  assert.equal(mods[0].name, 'Custom Master Module');
});

test('editing the template AFTER an org exists does not touch that org (deep copy)', async () => {
  const { req, models } = ctx;
  const res = await req('POST', '/organizations', SA, { name: 'Frozen Co', code: 'FROZEN' });
  const orgId = res.data.id;

  // Mutate the template's module title.
  await models.Module.updateOne({ organization: template._id, code: 'ZZ' }, { $set: { name: 'Renamed Master' } });

  const clone = await models.Module.findOne({ organization: orgId, code: 'ZZ' });
  assert.equal(clone.name, 'Custom Master Module', 'clone is unaffected by later template edits');
});

test('GET /organizations/template returns the reserved template org', async () => {
  const { req } = ctx;
  const res = await req('GET', '/organizations/template', SA);
  assert.equal(res.status, 200);
  assert.equal(res.data.code, 'TEMPLATE');
  assert.equal(res.data.isTemplate, true);
});

test('the template org is hidden from the tenant list and overview counts', async () => {
  const { req } = ctx;
  const list = await req('GET', '/organizations', SA);
  assert.ok(!list.data.some((o) => o.code === 'TEMPLATE'), 'template not in the org list');

  const overview = await req('GET', '/organizations/overview', SA);
  // The count reflects real orgs (the default Test Org + CLONE + FROZEN) but NOT
  // the template. Assert it matches the non-template orgs actually in the DB.
  const realOrgs = await ctx.models.Organization.countDocuments({ isTemplate: { $ne: true } });
  assert.equal(overview.data.organizations, realOrgs, 'count excludes the template org');
  assert.ok(realOrgs >= 3, 'default org + the two created here');
});

test('the master template org cannot be deleted', async () => {
  const { req } = ctx;
  const res = await req('DELETE', `/organizations/${template._id}`, SA);
  assert.equal(res.status, 400);
});
