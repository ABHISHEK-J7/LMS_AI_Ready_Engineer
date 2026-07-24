/**
 * End-to-end smoke test for the assessment lifecycle (topics, bank scoping,
 * ready-made templates, assigning, taking, grading). Boots the REAL Express app
 * against an in-memory Mongo (no live data touched) and drives it over HTTP.
 *
 *   node smoke-assessments.mjs
 */
import { startTestServer, iso } from './test/helpers.mjs';

let pass = 0;
let fail = 0;
const lines = [];
function check(name, cond, detail = '') {
  if (cond) { pass += 1; lines.push(`  [32m✓[0m ${name}`); }
  else { fail += 1; lines.push(`  [31m✗ ${name}${detail ? ` — ${detail}` : ''}[0m`); }
}
function section(t) { lines.push(`\n[1m${t}[0m`); }

const ctx = await startTestServer();
try {
  // ── Setup ──────────────────────────────────────────────────────────────────
  const trainer = await ctx.mkUser('Tr', 'tr@x.local', 'trainer');
  const student = await ctx.mkUser('St', 'st@x.local', 'student');
  const student2 = await ctx.mkUser('St2', 'st2@x.local', 'student');
  await ctx.mkUser('Admin', 'admin@x.local', 'admin');
  const mod = await ctx.models.Module.create({
    name: 'AI Fundamentals', code: 'AIF', order: 1, assignedTrainers: [trainer._id],
    topics: [{ title: 'Embeddings', order: 0 }, { title: 'RAG', order: 1 }, { title: 'Agents', order: 2 }],
  });
  const [T0, T1, T2] = mod.topics.map((t) => String(t._id));
  const titleOf = { [T0]: 'Embeddings', [T1]: 'RAG', [T2]: 'Agents' };
  const batch = await ctx.models.Batch.create({
    name: 'Batch A', code: 'BA', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'),
    students: [student._id, student2._id], trainers: [trainer._id], modules: [mod._id],
    moduleTrainers: [{ module: mod._id, trainers: [trainer._id] }],
  });
  student.batch = batch._id; await student.save();
  student2.batch = batch._id; await student2.save();
  const ADMIN = await ctx.login('admin@x.local');
  const T = await ctx.login('tr@x.local');
  const S = await ctx.login('st@x.local');
  const S2 = await ctx.login('st2@x.local');

  // ── 1. Question bank tagged per topic ────────────────────────────────────────
  section('1. Question bank (per-topic)');
  const bank = { [T0]: [], [T1]: [], [T2]: [] };
  for (const tid of [T0, T1, T2]) {
    for (let i = 0; i < 8; i += 1) {
      const r = await ctx.req('POST', '/question-bank', ADMIN, {
        module: String(mod._id), topic: tid, type: 'mcq',
        prompt: `${titleOf[tid]} Q${i}`, options: ['right', 'wrong'], correctOption: 0,
      });
      if (r.status === 201) bank[tid].push(r.data.id);
    }
  }
  check('24 questions created (8 per topic)', bank[T0].length === 8 && bank[T1].length === 8 && bank[T2].length === 8);
  const all = await ctx.req('GET', `/question-bank?module=${mod._id}`, ADMIN);
  check('GET bank returns all 24', Array.isArray(all.data) && all.data.length === 24, `got ${all.data?.length}`);
  const t0only = await ctx.req('GET', `/question-bank?module=${mod._id}&topic=${T0}`, ADMIN);
  check('GET bank?topic filters to that topic (8)', t0only.data?.length === 8, `got ${t0only.data?.length}`);
  check('bank items carry topic + topicTitle', all.data.every((q) => q.topic && q.topicTitle));

  // ── 2. Ready-made test with multiple topics ──────────────────────────────────
  section('2. Create ready-made test (multi-topic)');
  const tmplRes = await ctx.req('POST', '/assessments', ADMIN, {
    module: String(mod._id), title: 'Midterm Practice', type: 'practice', proctoring: 'none',
    topics: [T1, T0], // out of order on purpose
  });
  check('template created (201)', tmplRes.status === 201);
  check('isTemplate true', tmplRes.data?.isTemplate === true);
  check('stored 2 topics in MODULE order (Embeddings, RAG)',
    JSON.stringify((tmplRes.data?.topics ?? []).map((t) => t.title)) === JSON.stringify(['Embeddings', 'RAG']));
  const tmplId = tmplRes.data.id;

  const badTopic = await ctx.req('POST', '/assessments', ADMIN, {
    module: String(mod._id), title: 'Bad', type: 'practice', proctoring: 'none',
    topics: ['0'.repeat(24)],
  });
  check('a topic not in the module is rejected (400)', badTopic.status === 400);

  // ── 3. Add from bank — even split across the two topics (5 + 5) ───────────────
  section('3. Add questions from bank (scoped + split)');
  const pick = [...bank[T0].slice(0, 5), ...bank[T1].slice(0, 5)]; // what the "Select randomly" 5+5 would send
  const added = await ctx.req('POST', `/assessments/${tmplId}/questions/from-bank`, ADMIN, { questionIds: pick });
  check('added 10 questions', added.data?.questions?.length === 10, `got ${added.data?.questions?.length}`);
  const addedTopics = new Set(added.data.questions.map((q) => String(q.sourceId)));
  check('exactly the 10 picked were added (no dupes)', pick.every((id) => addedTopics.has(id)) && addedTopics.size === 10);
  const cap = await ctx.req('POST', `/assessments/${tmplId}/questions/from-bank`, ADMIN, { questionIds: [bank[T2][0]] });
  check('practice test capped at 10 (11th dropped)', cap.data?.questions?.length === 10 && cap.data?.capped === true);

  // ── 4. Assign to the batch → instance inherits topics ────────────────────────
  section('4. Trainer assigns the template');
  const asg = await ctx.req('POST', `/assessments/${tmplId}/assign`, T, { batch: String(batch._id) });
  check('assigned (201)', asg.status === 201);
  check('instance is not a template', asg.data?.isTemplate === false);
  check('instance inherits the 2 topics', (asg.data?.topics ?? []).length === 2);
  check('instance links back to its template', asg.data?.sourceTemplate === tmplId);
  const instId = asg.data.id;

  // ── 5. Visibility ────────────────────────────────────────────────────────────
  section('5. Visibility to students');
  const sList = await ctx.req('GET', '/assessments', S);
  check('student sees the assigned test', sList.data.some((a) => a.id === instId));
  check('student never sees the template', !sList.data.some((a) => a.id === tmplId));

  // ── 6. Student takes it → graded ─────────────────────────────────────────────
  section('6. Take + grade (all correct)');
  // A non-proctored practice test isn't "started" — its questions are read directly.
  const view = await ctx.req('GET', `/assessments/${instId}`, S);
  check('practice questions are visible (10)', view.data?.questions?.length === 10, `got ${view.data?.questions?.length}`);
  check('answer key is hidden from the student', view.data.questions.every((q) => q.correctOption === undefined));
  const answers = view.data.questions.map((q) => ({ question: q.id, selectedOption: 0 })); // option 0 = correct
  const submitted = await ctx.req('POST', `/assessments/${instId}/submit`, S, { answers });
  check('submit succeeds', submitted.status === 200 || submitted.status === 201);
  check('scored 100%', submitted.data?.score === 100, `got ${submitted.data?.score}`);
  check('marked passed', submitted.data?.passed === true);
  const reSubmit = await ctx.req('POST', `/assessments/${instId}/submit`, S, { answers });
  check('re-submitting is refused (already submitted)', reSubmit.status === 409);
  const subs = await ctx.req('GET', `/assessments/${instId}/submissions`, T);
  check('trainer sees the submission', Array.isArray(subs.data) && subs.data.length >= 1);

  // ── 7. Allow-list scoping ────────────────────────────────────────────────────
  section('7. Restrict who can take it');
  const tmpl2 = await ctx.req('POST', '/assessments', ADMIN, { module: String(mod._id), title: 'Scoped', type: 'practice', proctoring: 'none', topics: [T2] });
  await ctx.req('POST', `/assessments/${tmpl2.data.id}/questions/from-bank`, ADMIN, { questionIds: bank[T2].slice(0, 3) });
  const asg2 = await ctx.req('POST', `/assessments/${tmpl2.data.id}/assign`, T, { batch: String(batch._id), studentIds: [String(student._id)] });
  check('assigned to only student 1', asg2.status === 201);
  check('student 1 (allowed) sees it', (await ctx.req('GET', '/assessments', S)).data.some((a) => a.id === asg2.data.id));
  check('student 2 (not allowed) does NOT see it', !(await ctx.req('GET', '/assessments', S2)).data.some((a) => a.id === asg2.data.id));

  // ── 8. Proctored FINAL with an exam window ───────────────────────────────────
  section('8. Proctored final test');
  const finalT = await ctx.req('POST', '/assessments', ADMIN, {
    module: String(mod._id), title: 'Final', type: 'final', proctoring: 'app', durationMinutes: 45,
    topics: [T0, T1, T2],
  });
  check('final created with 3 topics', (finalT.data?.topics ?? []).length === 3);
  await ctx.req('POST', `/assessments/${finalT.data.id}/questions/from-bank`, ADMIN, { questionIds: [bank[T0][6], bank[T1][6], bank[T2][6]] });
  const asgFinal = await ctx.req('POST', `/assessments/${finalT.data.id}/assign`, T, { batch: String(batch._id), availableFrom: iso(-5), deadline: iso(180) });
  check('final assigned with a window (201)', asgFinal.status === 201);
  const detail = await ctx.req('GET', `/assessments/${asgFinal.data.id}`, S);
  check('proctored test hides questions until start', detail.data?.mustStart === true && (detail.data?.questions?.length ?? 0) === 0);
  const startFinal = await ctx.req('POST', `/assessments/${asgFinal.data.id}/start`, S);
  check('starting reveals the questions', (startFinal.data?.questions?.length ?? 0) === 3);

  // ── 9. Guards ────────────────────────────────────────────────────────────────
  section('9. Role guards');
  check('trainer cannot author a template (403)', (await ctx.req('POST', '/assessments', T, { module: String(mod._id), title: 'x', type: 'practice', proctoring: 'none' })).status === 403);
  check('trainer cannot edit a template\'s questions (403)', (await ctx.req('POST', `/assessments/${tmplId}/questions/from-bank`, T, { questionIds: [bank[T2][1]] })).status === 403);
  check('student cannot list the bank (403)', (await ctx.req('GET', `/question-bank?module=${mod._id}`, S)).status === 403);
} catch (e) {
  fail += 1;
  lines.push(`\n[31mUNCAUGHT: ${e?.message ?? e}[0m`);
} finally {
  await ctx.stop();
}

console.log(lines.join('\n'));
console.log(`\n${fail === 0 ? '[32m' : '[31m'}${pass} passed, ${fail} failed[0m`);
process.exit(fail === 0 ? 0 : 1);
