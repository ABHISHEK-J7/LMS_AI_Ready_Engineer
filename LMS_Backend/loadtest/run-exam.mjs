/**
 * Drives the "300 students take a proctored exam" scenario against server-exam.mjs.
 *
 * Phase 1 — LOGIN BURST: fire all N logins at the SAME instant (one Promise.all),
 *           measuring how long the whole burst takes + per-request p50/p95/p99.
 * Phase 2 — PROCTORED EXAM: with those tokens, every student runs the full timed
 *           lifecycle concurrently — start → autosave → 3 webcam snapshots (real
 *           multipart image → GridFS) → a warning → submit (synchronous MCQ grade).
 *
 *   LOADTEST_BASE=http://localhost:5099/api LOADTEST_USERS=300 node loadtest/run-exam.mjs
 */
const BASE = process.env.LOADTEST_BASE ?? 'http://localhost:5099/api';
const USERS = Number(process.env.LOADTEST_USERS ?? 300);

const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

// Smallest valid PNG (1x1) — stands in for a webcam JPEG snapshot.
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

async function waitForServer() {
  for (let i = 0; i < 120; i += 1) {
    try { if ((await fetch(`${BASE}/health`)).ok) return; } catch { /* not up */ }
    await sleep(500);
  }
  throw new Error('server did not come up');
}

async function login(i) {
  const t0 = performance.now();
  try {
    const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `lt-${i}@test.local`, password: 'Passw0rd!' }) });
    const tok = (await r.json())?.data?.tokens?.accessToken ?? null;
    return { ms: performance.now() - t0, tok, ok: r.status === 200 };
  } catch { return { ms: performance.now() - t0, tok: null, ok: false }; }
}

async function findAssessmentId(tok) {
  const r = await fetch(`${BASE}/assessments`, { headers: { Authorization: `Bearer ${tok}` } });
  const list = (await r.json())?.data ?? [];
  return list[0]?.id ?? null;
}

async function examLifecycle(tok, aid) {
  const auth = { Authorization: `Bearer ${tok}` };
  const steps = { start: false, save: false, shots: 0, warn: false, submit: false };
  try {
    // start
    const s = await fetch(`${BASE}/assessments/${aid}/start`, { method: 'POST', headers: auth });
    const started = (await s.json())?.data;
    if (!started?.questions) return steps;
    steps.start = true;
    const answers = started.questions.map((q) => ({ question: q.id, selectedOption: 0 }));

    // autosave
    const sv = await fetch(`${BASE}/assessments/${aid}/progress`, { method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }) });
    steps.save = sv.status < 400;

    // 3 webcam snapshots (multipart → GridFS)
    for (let k = 0; k < 3; k += 1) {
      const fd = new FormData();
      fd.append('shot', new Blob([PNG], { type: 'image/png' }), 'shot.png');
      const sh = await fetch(`${BASE}/assessments/${aid}/proctor-shot`, { method: 'POST', headers: auth, body: fd });
      if (sh.status < 400) steps.shots += 1;
    }

    // a proctoring warning
    const w = await fetch(`${BASE}/assessments/${aid}/warning`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'tab switch' }) });
    steps.warn = w.status < 400;

    // submit (synchronous MCQ grade)
    const sub = await fetch(`${BASE}/assessments/${aid}/submit`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }) });
    steps.submit = sub.status < 400;
  } catch { /* recorded as incomplete */ }
  return steps;
}

async function main() {
  await waitForServer();
  console.log(`\nTarget: ${USERS} students · ${BASE}\n`);

  // ── Phase 1: 300 concurrent logins fired at once ─────────────────────────────
  const burstT0 = performance.now();
  const results = await Promise.all(Array.from({ length: USERS }, (_, i) => login(i)));
  const burstMs = performance.now() - burstT0;
  const lat = results.map((r) => r.ms);
  const tokens = results.map((r) => r.tok);
  const okCount = results.filter((r) => r.ok && r.tok).length;

  console.log('── PHASE 1 · LOGIN BURST (all fired simultaneously) ──────────────');
  console.log(`  logged in:      ${okCount}/${USERS} (${(okCount / USERS * 100).toFixed(1)}%)`);
  console.log(`  wall clock:     ${(burstMs / 1000).toFixed(2)}s to clear the whole burst`);
  console.log(`  throughput:     ${(okCount / (burstMs / 1000)).toFixed(0)} logins/s`);
  console.log(`  latency:        mean ${mean(lat).toFixed(0)}ms · p50 ${pct(lat, 50).toFixed(0)}ms · p95 ${pct(lat, 95).toFixed(0)}ms · p99 ${pct(lat, 99).toFixed(0)}ms · max ${Math.max(...lat).toFixed(0)}ms`);

  const authed = tokens.filter(Boolean);
  const aid = await findAssessmentId(authed[0]);
  if (!aid) { console.log('\nNo assessment visible to students — aborting exam phase.'); return; }

  // ── Phase 2: all students run the proctored exam lifecycle concurrently ───────
  console.log('\n── PHASE 2 · PROCTORED EXAM (start→save→3 snapshots→warn→submit) ─');
  const exT0 = performance.now();
  const perUser = [];
  const flows = await Promise.all(authed.map(async (tok) => {
    const t0 = performance.now();
    const steps = await examLifecycle(tok, aid);
    perUser.push(performance.now() - t0);
    return steps;
  }));
  const exMs = performance.now() - exT0;

  const done = (k) => flows.filter((f) => f[k]).length;
  const fullySubmitted = flows.filter((f) => f.submit).length;
  const totalShots = flows.reduce((n, f) => n + f.shots, 0);

  console.log(`  started:        ${done('start')}/${authed.length}`);
  console.log(`  autosaved:      ${done('save')}/${authed.length}`);
  console.log(`  snapshots:      ${totalShots} images stored to GridFS (target ${authed.length * 3})`);
  console.log(`  warnings:       ${done('warn')}/${authed.length}`);
  console.log(`  submitted+graded: ${fullySubmitted}/${authed.length} (${(fullySubmitted / authed.length * 100).toFixed(1)}%)`);
  console.log(`  wall clock:     ${(exMs / 1000).toFixed(2)}s for all students to finish the full flow`);
  console.log(`  per-student:    mean ${(mean(perUser)).toFixed(0)}ms · p50 ${pct(perUser, 50).toFixed(0)}ms · p95 ${pct(perUser, 95).toFixed(0)}ms · p99 ${pct(perUser, 99).toFixed(0)}ms`);

  console.log('\nVerdict: PASS if login errors ≈ 0%, submitted ≈ 100%, and the burst clears in a few seconds.');
}

main().catch((e) => { console.error(e); process.exit(1); });
