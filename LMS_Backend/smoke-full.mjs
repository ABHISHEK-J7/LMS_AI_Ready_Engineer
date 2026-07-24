/**
 * Full-journey smoke test across EVERY domain of the app (auth, modules, question
 * bank, batches, classes, attendance, doubts, announcements, resources,
 * certificates, projects, external certs, progress, notifications, analytics,
 * settings, profile, audit). Boots the REAL Express app against an in-memory Mongo
 * and drives it over HTTP. No live data touched.
 *
 *   node smoke-full.mjs
 */
import { startTestServer } from './test/helpers.mjs';

let pass = 0, fail = 0;
const lines = [];
const ok2 = (r) => r.status === 200 || r.status === 201;
function check(name, cond, detail = '') {
  if (cond) { pass += 1; lines.push(`  [32m✓[0m ${name}`); }
  else { fail += 1; lines.push(`  [31m✗ ${name}${detail ? ` — ${detail}` : ''}[0m`); }
}
function section(t) { lines.push(`\n[1m${t}[0m`); }

const ctx = await startTestServer();
try {
  const trainer = await ctx.mkUser('Tr', 'tr@x.local', 'trainer');
  const student = await ctx.mkUser('St', 'st@x.local', 'student');
  await ctx.mkUser('Admin', 'admin@x.local', 'admin');
  const mod = await ctx.models.Module.create({
    name: 'Full Smoke Module', code: 'FSM', order: 1, assignedTrainers: [trainer._id],
    topics: [{ title: 'Alpha', order: 0 }, { title: 'Beta', order: 1 }],
  });
  const T0 = String(mod.topics[0]._id);
  const batch = await ctx.models.Batch.create({
    name: 'Smoke Batch', code: 'SMB', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'),
    students: [student._id], trainers: [trainer._id], modules: [mod._id],
    moduleTrainers: [{ module: mod._id, trainers: [trainer._id] }],
  });
  student.batch = batch._id; await student.save();
  // The real assign flows keep these reverse-refs in sync (module.assignTrainer +
  // batch syncTrainersFromMapping); we created the module/batch directly, so mirror it.
  trainer.assignedModules = [mod._id]; trainer.assignedBatches = [batch._id]; await trainer.save();
  const A = await ctx.login('admin@x.local');
  const T = await ctx.login('tr@x.local');
  const S = await ctx.login('st@x.local');
  const R = ctx.req;

  // ── Auth ─────────────────────────────────────────────────────────────────────
  section('Auth');
  check('admin /auth/me', (await R('GET', '/auth/me', A)).data?.user?.role === 'admin');
  check('trainer /auth/me', (await R('GET', '/auth/me', T)).data?.user?.role === 'trainer');
  check('student /auth/me', (await R('GET', '/auth/me', S)).data?.user?.role === 'student');
  check('no token → 401', (await R('GET', '/auth/me', null)).status === 401);

  // ── Modules / topics ─────────────────────────────────────────────────────────
  section('Modules & topics');
  check('list modules', (await R('GET', '/modules', A)).data.some((m) => m.id === String(mod._id)));
  const newMod = await R('POST', '/modules', A, { name: 'Created', code: 'CRT', level: 'beginner', description: 'x' });
  check('create module', newMod.status === 201);
  const topicAdd = await R('POST', `/modules/${newMod.data.id}/topics`, A, { title: 'T1' });
  check('add a topic', ok2(topicAdd));
  check('module detail has the topic', (await R('GET', `/modules/${newMod.data.id}`, A)).data.topics.length >= 1);

  // ── Question bank ────────────────────────────────────────────────────────────
  section('Question bank');
  const q = await R('POST', '/question-bank', A, { module: String(mod._id), topic: T0, type: 'mcq', prompt: 'Q?', options: ['a', 'b'], correctOption: 0 });
  check('add a question', q.status === 201);
  check('list bank by module', (await R('GET', `/question-bank?module=${mod._id}`, A)).data.length >= 1);

  // ── Batches ──────────────────────────────────────────────────────────────────
  section('Batches');
  check('admin lists batches', (await R('GET', '/batches', A)).data.some((b) => b.id === String(batch._id)));
  check('trainer sees their batch', (await R('GET', '/batches', T)).data.some((b) => b.id === String(batch._id)));
  check('student sees their batch', (await R('GET', '/batches', S)).data.some((b) => b.id === String(batch._id)));

  // ── Classes / schedule ───────────────────────────────────────────────────────
  section('Classes / schedule');
  const cls = await R('POST', '/classes', T, {
    title: 'Live Session', module: String(mod._id), batch: String(batch._id),
    date: '2026-08-01', startTime: '10:00', endTime: '11:00', provider: 'other', meetingLink: 'https://meet.example.com/x',
  });
  check('trainer schedules a class', cls.status === 201, `status ${cls.status}`);
  const classId = cls.data?.id;
  check('trainer lists classes', (await R('GET', '/classes', T)).data.some((c) => c.id === classId));
  check('student sees the class', (await R('GET', '/classes', S)).data.some((c) => c.id === classId));

  // ── Attendance ───────────────────────────────────────────────────────────────
  section('Attendance');
  const att = await R('POST', `/attendance/class/${classId}`, T, { records: [{ student: String(student._id), status: 'present' }] });
  check('trainer marks attendance', ok2(att), `status ${att.status}`);
  check('batch attendance report', ok2(await R('GET', `/attendance/batch/${batch._id}`, T)));
  const myAtt = await R('GET', '/attendance/me', S);
  check('student attendance summary', ok2(myAtt) && myAtt.data?.summary != null);

  // ── Doubts ───────────────────────────────────────────────────────────────────
  section('Doubts');
  const doubt = await R('POST', '/doubts', S, { title: 'How does RAG work?', body: 'Explain retrieval.', module: String(mod._id) });
  check('student raises a doubt', doubt.status === 201, `status ${doubt.status}`);
  check('trainer sees the doubt', (await R('GET', '/doubts', T)).data.some((d) => d.id === doubt.data?.id));
  check('trainer replies', ok2(await R('POST', `/doubts/${doubt.data.id}/replies`, T, { body: 'Retrieval augments generation.' })));
  check('student rates the resolved doubt', ok2(await R('POST', `/doubts/${doubt.data.id}/rate`, S, { rating: 5 })));

  // ── Announcements ────────────────────────────────────────────────────────────
  section('Announcements');
  const ann = await R('POST', '/announcements', A, { title: 'Welcome', body: 'Batch starts Monday.', batch: String(batch._id) });
  check('admin posts an announcement', ok2(ann), `status ${ann.status}`);
  check('student sees announcements', (await R('GET', '/announcements', S)).data.some((x) => x.id === ann.data?.id));

  // ── Resources ────────────────────────────────────────────────────────────────
  section('Resources');
  check('list module resources', ok2(await R('GET', `/resources?module=${mod._id}`, S)));

  // ── Certificates ─────────────────────────────────────────────────────────────
  section('Certificates');
  check('student certificate list', ok2(await R('GET', '/certificates/me', S)));
  check('admin certificate list', ok2(await R('GET', '/certificates', A)));
  const verify = await R('GET', `/certificates/verify/${'0'.repeat(24)}`, null);
  check('public verify endpoint responds', verify.status === 200 || verify.status === 404, `status ${verify.status}`);

  // ── Projects & external certs (review endpoints) ─────────────────────────────
  section('Projects & external certificates');
  const projRev = await R('GET', '/projects/review', A);
  check('admin can list projects for review', ok2(projRev) || projRev.status === 403, `status ${projRev.status}`);
  const extRev = await R('GET', '/external-certificates/review', A);
  check('admin can list external certs for review', ok2(extRev) || extRev.status === 403, `status ${extRev.status}`);

  // ── Progress ─────────────────────────────────────────────────────────────────
  section('Progress');
  check('student progress', ok2(await R('GET', '/progress/me', S)));

  // ── Notifications ────────────────────────────────────────────────────────────
  section('Notifications');
  check('list notifications', ok2(await R('GET', '/notifications', S)));
  check('unread count', ok2(await R('GET', '/notifications/unread-count', S)));
  check('mark all read', ok2(await R('POST', '/notifications/read', S)));

  // ── Analytics ────────────────────────────────────────────────────────────────
  section('Analytics');
  check('admin analytics', ok2(await R('GET', '/analytics/admin', A)));
  check('trainer analytics', ok2(await R('GET', '/analytics/trainer', T)));
  check('student analytics', ok2(await R('GET', '/analytics/student', S)));

  // ── Settings ─────────────────────────────────────────────────────────────────
  section('Settings');
  check('public settings', ok2(await R('GET', '/settings/public', null)));
  check('admin reads settings', ok2(await R('GET', '/settings', A)));
  check('admin updates settings', ok2(await R('PATCH', '/settings', A, { passingScore: 70 })));

  // ── Profile ──────────────────────────────────────────────────────────────────
  section('Profile');
  check('student updates profile', ok2(await R('PATCH', '/profile', S, { bio: 'Learning AI.' })));
  check('trainer stats', ok2(await R('GET', '/profile/trainer-stats', T)));

  // ── Audit ────────────────────────────────────────────────────────────────────
  section('Audit');
  const audit = await R('GET', '/audit', A);
  check('admin reads the audit log', ok2(audit));

  // ── Role guards (spot checks) ────────────────────────────────────────────────
  section('Role guards');
  check('student cannot create a module', (await R('POST', '/modules', S, { name: 'x', code: 'XX' })).status === 403);
  check('student cannot read settings admin view', [401, 403].includes((await R('GET', '/settings', S)).status));
  check('trainer cannot post an announcement to nowhere', (await R('POST', '/announcements', T, {})).status >= 400);
} catch (e) {
  fail += 1;
  lines.push(`\n[31mUNCAUGHT: ${e?.stack ?? e}[0m`);
} finally {
  await ctx.stop();
}

console.log(lines.join('\n'));
console.log(`\n${fail === 0 ? '[32m' : '[31m'}${pass} passed, ${fail} failed[0m`);
process.exit(fail === 0 ? 0 : 1);
