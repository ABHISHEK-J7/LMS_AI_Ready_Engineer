import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';

/**
 * Boot the real Express app against an in-memory MongoDB. Each test file gets an
 * isolated server (node --test runs files in separate processes).
 */
export async function startTestServer() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-access';
  process.env.JWT_REFRESH_SECRET = 'test-refresh';
  // NEVER send real email from tests — force the dev mailer (logs, doesn't send).
  // dotenv won't override an already-set key, so this wins over a real .env.
  process.env.SMTP_HOST = '';
  process.env.SMTP_USER = '';
  process.env.SMTP_PASS = '';

  const mongoose = (await import('mongoose')).default;
  const { createApp } = await import('../src/app.js');
  const models = await import('../src/models/index.js');
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all(Object.values(mongoose.models).map((m) => m.init().catch(() => {})));
  const server = createApp().listen(0);
  const base = `http://localhost:${server.address().port}/api`;

  // A default organization every test user belongs to (matches production: real
  // users always carry an org). Tests that exercise isolation pass their own org.
  const defaultOrg = await models.Organization.create({ name: 'Test Org', code: 'TEST' });
  // Stamp fixtures created via direct model calls (outside a request) with this org,
  // so they're visible to the org-scoped API reads the tests then make.
  const { setAmbientOrg } = await import('../src/services/tenantContext.js');
  setAmbientOrg(defaultOrg._id);

  async function req(method, path, token, body) {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch { /* no body */ }
    return { status: res.status, data: json?.data, tokens: json?.data?.tokens };
  }
  async function mkUser(name, email, role, extra = {}) {
    // Non-super users belong to the default org unless the test overrides it;
    // the super admin stays global (organization: null).
    const organization = 'organization' in extra
      ? extra.organization
      : (role === 'super_admin' ? null : defaultOrg._id);
    return models.User.create({ name, email, role, status: 'active', organization, passwordHash: await bcrypt.hash('Passw0rd!', 4), ...extra });
  }
  const login = async (email) => (await req('POST', '/auth/login', null, { email, password: 'Passw0rd!' })).tokens?.accessToken;

  async function stop() {
    await mongoose.disconnect();
    await new Promise((r) => server.close(r));
    await mongod.stop();
  }
  return { base, req, mkUser, login, models, mongoose, stop, defaultOrg };
}

export const iso = (min) => new Date(Date.now() + min * 60000).toISOString();
