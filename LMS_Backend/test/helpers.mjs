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

  const mongoose = (await import('mongoose')).default;
  const { createApp } = await import('../src/app.js');
  const models = await import('../src/models/index.js');
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all(Object.values(mongoose.models).map((m) => m.init().catch(() => {})));
  const server = createApp().listen(0);
  const base = `http://localhost:${server.address().port}/api`;

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
    return models.User.create({ name, email, role, status: 'active', passwordHash: await bcrypt.hash('Passw0rd!', 4), ...extra });
  }
  const login = async (email) => (await req('POST', '/auth/login', null, { email, password: 'Passw0rd!' })).tokens?.accessToken;

  async function stop() {
    await mongoose.disconnect();
    await new Promise((r) => server.close(r));
    await mongod.stop();
  }
  return { base, req, mkUser, login, models, mongoose, stop };
}

export const iso = (min) => new Date(Date.now() + min * 60000).toISOString();
