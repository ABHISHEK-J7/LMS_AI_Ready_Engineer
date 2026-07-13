import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.mjs';

let ctx, SA;
before(async () => {
  ctx = await startTestServer();
  await ctx.mkUser('Super', 'super@x.local', 'super_admin'); // organization: null
  SA = await ctx.login('super@x.local');
});
after(async () => { await ctx.stop(); });

// ── C1: a non-super user with no organization is denied all tenant data ────────
test('C1: a null-org non-super user sees nothing and cannot create tenant data', async () => {
  const { req, mkUser, models } = ctx;
  await mkUser('Orphan', 'orphan@x.local', 'admin');
  // Force a genuinely org-less account (the test-ambient org would otherwise stamp
  // one on create); updateOne bypasses the write-stamp. This simulates the
  // pre-fix orphaned self-registered user.
  await models.User.updateOne({ email: 'orphan@x.local' }, { $set: { organization: null } });
  const T = await ctx.login('orphan@x.local');

  // Reads are scoped to "no match" — never the whole platform.
  const users = await req('GET', '/users', T);
  assert.equal(users.status, 200);
  assert.equal(users.data.items.length, 0, 'null-org admin sees zero users, not every org');

  // Writes are refused (can't stamp an org).
  const created = await req('POST', '/modules', T, { name: 'X', code: 'XX', level: 'beginner' });
  assert.ok(created.status >= 400, 'null-org admin cannot create a module');
});

// ── C2: public self-registration is disabled ──────────────────────────────────
test('C2: POST /auth/register is disabled', async () => {
  const { req } = ctx;
  const r = await req('POST', '/auth/register', null, { name: 'New Guy', email: 'new@x.local', password: 'Passw0rd!' });
  assert.equal(r.status, 403, 'self-registration is forbidden');
});

// ── C2b: a PENDING account cannot self-activate via OTP onboarding ─────────────
test('C2b: a PENDING user is not onboardable (no OTP issued); an ACTIVE one is', async () => {
  const { req, models } = ctx;
  await models.User.create({ name: 'Pend', email: 'pend@x.local', role: 'student', status: 'pending' });
  await models.User.create({ name: 'Act', email: 'act@x.local', role: 'student', status: 'active' });

  const pending = await req('POST', '/auth/request-otp', null, { email: 'pend@x.local' });
  assert.equal(pending.data.sent, true, 'response never reveals the account state');
  assert.equal(pending.data.devOtp, undefined, 'no code is issued for a pending account');

  const active = await req('POST', '/auth/request-otp', null, { email: 'act@x.local' });
  assert.ok(active.data.devOtp, 'an active account can onboard via OTP');
});

// ── H1: settings are per-organization (no 500 for a second org, isolated) ──────
test('H1: each organization has its own settings; a second org admin does not 500', async () => {
  const { req } = ctx;
  const a = await req('POST', '/organizations', SA, { name: 'Org A', code: 'ORGA', adminName: 'A Admin', adminEmail: 'a@orga.local', adminPassword: 'Passw0rd!' });
  const b = await req('POST', '/organizations', SA, { name: 'Org B', code: 'ORGB', adminName: 'B Admin', adminEmail: 'b@orgb.local', adminPassword: 'Passw0rd!' });
  assert.equal(a.status, 201); assert.equal(b.status, 201);
  const A = await ctx.login('a@orga.local');
  const B = await ctx.login('b@orgb.local');

  // Both admins can load their settings (the old global-unique key made this 500 for the 2nd org).
  assert.equal((await req('GET', '/settings', A)).status, 200);
  assert.equal((await req('GET', '/settings', B)).status, 200);

  // Editing A's settings does not touch B's.
  const upd = await req('PATCH', '/settings', A, { passingScore: 55 });
  assert.equal(upd.status, 200);
  assert.equal(upd.data.passingScore, 55);
  const bSettings = await req('GET', '/settings', B);
  assert.notEqual(bSettings.data.passingScore, 55, "org B keeps its own passing score");
});

// ── M4: email is a global identity — cross-org reuse is a clean 409, not a 500 ─
test('M4: an admin cannot create a user whose email exists in another org (clean 409)', async () => {
  const { req } = ctx;
  await req('POST', '/organizations', SA, { name: 'Org C', code: 'ORGC', adminName: 'C Admin', adminEmail: 'c@orgc.local', adminPassword: 'Passw0rd!' });
  await req('POST', '/organizations', SA, { name: 'Org D', code: 'ORGD', adminName: 'D Admin', adminEmail: 'd@orgd.local', adminPassword: 'Passw0rd!' });
  const C = await ctx.login('c@orgc.local');
  const D = await ctx.login('d@orgd.local');

  const first = await req('POST', '/users', C, { name: 'Shared', email: 'shared@x.local', password: 'Passw0rd!', role: 'student' });
  assert.equal(first.status, 201);
  // Org D reusing the same email → 409 (not a raw duplicate-key 500).
  const dup = await req('POST', '/users', D, { name: 'Shared Two', email: 'shared@x.local', password: 'Passw0rd!', role: 'student' });
  assert.equal(dup.status, 409);
});

// ── H2: a suspended organization locks out its members (super admin exempt) ────
test('H2: suspending an org blocks its users at login and mid-session; reactivating restores', async () => {
  const { req } = ctx;
  const org = await req('POST', '/organizations', SA, { name: 'Susp', code: 'SUSP', adminName: 'S Admin', adminEmail: 's@susp.local', adminPassword: 'Passw0rd!' });
  const orgId = org.data.id;
  const S = await ctx.login('s@susp.local');
  assert.equal((await req('GET', '/users', S)).status, 200, 'works while active');

  // Suspend the org.
  assert.equal((await req('PATCH', `/organizations/${orgId}`, SA, { status: 'suspended' })).status, 200);

  // Existing session is blocked immediately (auth cache invalidated on suspend).
  assert.equal((await req('GET', '/users', S)).status, 403, 'mid-session request blocked');
  // New login is blocked too.
  const relog = await req('POST', '/auth/login', null, { email: 's@susp.local', password: 'Passw0rd!' });
  assert.equal(relog.status, 403, 'login blocked while suspended');
  // The super admin is unaffected.
  assert.equal((await req('GET', '/organizations', SA)).status, 200);

  // Reactivating restores access.
  assert.equal((await req('PATCH', `/organizations/${orgId}`, SA, { status: 'active' })).status, 200);
  const relog2 = await req('POST', '/auth/login', null, { email: 's@susp.local', password: 'Passw0rd!' });
  assert.ok(relog2.tokens?.accessToken, 'login works again after reactivation');
});
