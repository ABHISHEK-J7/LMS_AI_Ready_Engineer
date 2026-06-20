/**
 * Closed-loop load driver. Logs in the seeded students once, then ramps a fixed
 * number of concurrent virtual users hammering a realistic read mix (the student
 * dashboard/polling set) for a few seconds per level, reporting throughput +
 * latency percentiles. Also measures login (bcrypt) throughput separately.
 *
 *   LOADTEST_BASE=http://localhost:5099/api LOADTEST_USERS=150 \
 *   LOADTEST_DURATION=8 LOADTEST_LEVELS=50,100,200,400,800 node loadtest/run.mjs
 */
const BASE = process.env.LOADTEST_BASE ?? 'http://localhost:5099/api';
const USERS = Number(process.env.LOADTEST_USERS ?? 150);
const DURATION = Number(process.env.LOADTEST_DURATION ?? 8);
const LEVELS = (process.env.LOADTEST_LEVELS ?? '50,100,200,400,800').split(',').map(Number);

const READS = ['/progress/me', '/classes', '/assessments', '/notifications', '/attendance/me'];
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(`${BASE}/health`)).ok) return; } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error('server did not come up');
}

async function login(i) {
  try {
    const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `lt-${i}@test.local`, password: 'Passw0rd!' }) });
    return (await r.json())?.data?.tokens?.accessToken ?? null;
  } catch { return null; }
}

async function main() {
  await waitForServer();

  // ── Login throughput (bcrypt) — concurrency 50, ~5s ──────────────────────────
  {
    const deadline = Date.now() + 5000;
    let n = 0; let errs = 0; const lat = [];
    const worker = async () => {
      while (Date.now() < deadline) {
        const t0 = performance.now();
        const tok = await login((Math.random() * USERS) | 0);
        lat.push(performance.now() - t0); n += 1; if (!tok) errs += 1;
      }
    };
    const t0 = Date.now();
    await Promise.all(Array.from({ length: 50 }, worker));
    const secs = (Date.now() - t0) / 1000;
    console.log(`\nLOGIN (bcrypt, C=50): ${(n / secs).toFixed(0)} logins/s · err ${(errs / n * 100).toFixed(1)}% · p50 ${pct(lat, 50).toFixed(0)}ms · p95 ${pct(lat, 95).toFixed(0)}ms`);
  }

  // ── Pre-authenticate a token pool for the read test ──────────────────────────
  const tokens = (await Promise.all(Array.from({ length: USERS }, (_, i) => login(i)))).filter(Boolean);
  console.log(`\nAuthenticated ${tokens.length}/${USERS} students.\n`);
  console.log('READ MIX (authenticated GETs: progress/classes/assessments/notifications/attendance)');
  console.log('conc |   req/s | err% | p50ms | p95ms | p99ms');
  console.log('-----+---------+------+-------+-------+------');

  const oneReq = async () => {
    const tok = tokens[(Math.random() * tokens.length) | 0];
    const path = READS[(Math.random() * READS.length) | 0];
    const t0 = performance.now();
    let ok = false;
    try {
      const r = await fetch(BASE + path, { headers: { Authorization: `Bearer ${tok}` } });
      ok = r.status < 400;
      await r.arrayBuffer();
    } catch { /* counts as error */ }
    return [performance.now() - t0, ok];
  };

  for (const C of LEVELS) {
    const deadline = Date.now() + DURATION * 1000;
    const lat = []; let errs = 0; let n = 0;
    const worker = async () => {
      while (Date.now() < deadline) { const [l, ok] = await oneReq(); lat.push(l); n += 1; if (!ok) errs += 1; }
    };
    const t0 = Date.now();
    await Promise.all(Array.from({ length: C }, worker));
    const secs = (Date.now() - t0) / 1000;
    console.log(`${String(C).padStart(4)} | ${String((n / secs).toFixed(0)).padStart(7)} | ${String((errs / n * 100).toFixed(1)).padStart(4)} | ${String(pct(lat, 50).toFixed(0)).padStart(5)} | ${String(pct(lat, 95).toFixed(0)).padStart(5)} | ${String(pct(lat, 99).toFixed(0)).padStart(5)}`);
  }
  console.log('\nThe "knee" — where req/s plateaus and p95/p99 climb sharply — is the single-instance ceiling on this machine.');
}

main().catch((e) => { console.error(e); process.exit(1); });
