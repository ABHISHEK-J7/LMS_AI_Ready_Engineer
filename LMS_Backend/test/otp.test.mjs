import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.mjs';

let ctx;
before(async () => { ctx = await startTestServer(); }); // startTestServer forces the dev mailer
after(async () => { await ctx.stop(); });

test('OTP onboarding: request → verify → set password → login works end to end', async () => {
  const { req, models } = ctx;
  await models.User.create({ name: 'Otp', email: 'otp@x.local', role: 'student', status: 'pending' });

  // Capture the dev-mailer console output to read the emailed 6-digit code.
  let captured = '';
  const orig = console.log;
  console.log = (...a) => { captured += a.join(' ') + '\n'; };
  try {
    const r = await req('POST', '/auth/request-otp', null, { email: 'otp@x.local' });
    assert.equal(r.data.sent, true);
  } finally {
    console.log = orig;
  }
  const otp = (captured.match(/\b(\d{6})\b/) || [])[1];
  assert.ok(otp, 'the OTP email should contain a 6-digit code');

  // A wrong code is rejected.
  assert.equal((await req('POST', '/auth/verify-otp', null, { email: 'otp@x.local', otp: '000000' })).status, 400);

  // The correct code returns a one-shot reset token.
  const v = await req('POST', '/auth/verify-otp', null, { email: 'otp@x.local', otp });
  assert.ok(v.data.resetToken, 'verify returns a reset token');

  // Set the password, then log in with it.
  const sp = await req('POST', '/auth/set-password', null, { resetToken: v.data.resetToken, password: 'NewPassw0rd!' });
  assert.equal(sp.status, 200);
  const login = await req('POST', '/auth/login', null, { email: 'otp@x.local', password: 'NewPassw0rd!' });
  assert.ok(login.tokens?.accessToken, 'can log in with the new password');
});

test('OTP is case-insensitive on the email (mixed-case request + verify)', async () => {
  const { req, models } = ctx;
  await models.User.create({ name: 'Case', email: 'case@x.local', role: 'student', status: 'pending' });
  let captured = '';
  const orig = console.log;
  console.log = (...a) => { captured += a.join(' ') + '\n'; };
  try {
    await req('POST', '/auth/request-otp', null, { email: 'CASE@X.LOCAL' });
  } finally {
    console.log = orig;
  }
  const otp = (captured.match(/\b(\d{6})\b/) || [])[1];
  assert.ok(otp, 'code sent for a mixed-case email');
  const v = await req('POST', '/auth/verify-otp', null, { email: 'Case@X.Local', otp });
  assert.ok(v.data.resetToken, 'mixed-case email still verifies');
});
