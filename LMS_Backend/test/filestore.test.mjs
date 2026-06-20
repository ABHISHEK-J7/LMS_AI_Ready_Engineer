import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.mjs';

let ctx;
let T;
let fileToken;
let mod;
let origin;

const withToken = (url) => `${origin}${url}${url.includes('?') ? '&' : '?'}t=${fileToken}`;

before(async () => {
  ctx = await startTestServer();
  const trainer = await ctx.mkUser('T', 't@x.local', 'trainer');
  mod = await ctx.models.Module.create({ name: 'M', code: 'FS', order: 1, assignedTrainers: [trainer._id] });
  T = await ctx.login('t@x.local');
  const lr = await ctx.req('POST', '/auth/login', null, { email: 't@x.local', password: 'Passw0rd!' });
  fileToken = lr.tokens.fileToken;
  origin = ctx.base.replace(/\/api$/, '');
});
after(async () => { await ctx.stop(); });

test('a resource file streams into GridFS and serves back (full GET)', async () => {
  const body = Buffer.from('hello world '.repeat(64)); // 768 bytes
  const fd = new FormData();
  fd.set('module', String(mod._id));
  fd.set('type', 'document');
  fd.set('title', 'Class notes');
  fd.set('file', new Blob([body], { type: 'text/markdown' }), 'notes.md');

  const up = await fetch(`${ctx.base}/resources`, { method: 'POST', headers: { Authorization: `Bearer ${T}` }, body: fd });
  assert.equal(up.status, 201);
  const json = await up.json();
  const url = json.data.url;
  assert.match(url, /^\/api\/uploads\/resource-[0-9a-f]/); // crypto filename

  const res = await fetch(withToken(url));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/markdown');
  assert.equal(res.headers.get('accept-ranges'), 'bytes');
  assert.equal(Number(res.headers.get('content-length')), body.length);
  const got = Buffer.from(await res.arrayBuffer());
  assert.ok(got.equals(body), 'served bytes match uploaded bytes');
});

test('serving supports HTTP Range (206) and rejects unsatisfiable ranges (416)', async () => {
  const body = Buffer.from('0123456789ABCDEF'.repeat(16)); // 256 bytes
  const fd = new FormData();
  fd.set('module', String(mod._id));
  fd.set('type', 'document');
  fd.set('title', 'Ranged');
  fd.set('file', new Blob([body], { type: 'text/plain' }), 'r.txt');
  const up = await fetch(`${ctx.base}/resources`, { method: 'POST', headers: { Authorization: `Bearer ${T}` }, body: fd });
  const url = (await up.json()).data.url;

  const partial = await fetch(withToken(url), { headers: { Range: "bytes=0-15" } });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get('content-range'), `bytes 0-15/${body.length}`);
  assert.equal(Number(partial.headers.get('content-length')), 16);
  const chunk = Buffer.from(await partial.arrayBuffer());
  assert.equal(chunk.length, 16);
  assert.ok(chunk.equals(body.subarray(0, 16)));

  const bad = await fetch(withToken(url), { headers: { Range: `bytes=${body.length + 10}-` } });
  assert.equal(bad.status, 416);
});

test('a missing file returns 404', async () => {
  const res = await fetch(withToken("/api/uploads/does-not-exist.png"));
  assert.equal(res.status, 404);
});

test('file access without a token is refused (401)', async () => {
  // Upload a file, then try to fetch it with NO token.
  const fd = new FormData();
  fd.set('module', String(mod._id));
  fd.set('type', 'document');
  fd.set('title', 'Private');
  fd.set('file', new Blob([Buffer.from('secret')], { type: 'text/plain' }), 'p.txt');
  const up = await fetch(`${ctx.base}/resources`, { method: 'POST', headers: { Authorization: `Bearer ${T}` }, body: fd });
  const url = (await up.json()).data.url;

  assert.equal((await fetch(origin + url)).status, 401, 'no token → 401');
  assert.equal((await fetch(`${origin}${url}?t=garbage`)).status, 401, 'bad token → 401');
  assert.equal((await fetch(withToken(url))).status, 200, 'valid file token → 200');
});

test('certificate uniqueness index prevents duplicate program/module certs', async () => {
  const student = await ctx.mkUser('Cert', 'c@x.local', 'student');
  const base = { student: student._id, verifyUrl: 'http://x/verify', isProgramCertificate: true, module: null };
  await ctx.models.Certificate.create({ ...base, certificateId: 'AIRE-1' });
  await assert.rejects(
    ctx.models.Certificate.create({ ...base, certificateId: 'AIRE-2' }),
    (err) => err?.code === 11000,
    'second program certificate for the same student must hit the unique index',
  );
});
