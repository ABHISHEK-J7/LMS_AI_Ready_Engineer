import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.mjs';

let ctx, SA, orgId, templateId;
before(async () => {
  ctx = await startTestServer();
  await ctx.mkUser('Super', 'super@x.local', 'super_admin');
  SA = await ctx.login('super@x.local');

  // Master template org with a module 'ST' carrying a full syllabus.
  const template = await ctx.models.Organization.create({ name: 'Master Template', code: 'TEMPLATE', isTemplate: true });
  templateId = template._id;
  await ctx.models.Module.create({
    organization: templateId, name: 'Syllabus Mod', code: 'ST', order: 1, level: 'beginner',
    description: 'Master description', learningObjectives: ['obj A'],
    topics: [
      { title: 'Topic One', description: 'T1 desc', order: 0, subtopics: [{ title: 'Sub 1', description: 'S1 desc' }] },
      { title: 'Topic Two', description: 'T2 desc', order: 1, subtopics: [] },
    ],
  });

  // A real org — cloned from the template at creation.
  const org = await ctx.req('POST', '/organizations', SA, { name: 'Acme', code: 'ACME', adminName: 'Acme Admin', adminEmail: 'admin@acme.local', adminPassword: 'Passw0rd!' });
  orgId = org.data.id;
});
after(async () => { await ctx.stop(); });

const asOrg = () => ({ 'X-Org-Id': orgId });

test('master syllabus preview shows titles + counts and applies nothing', async () => {
  const { req, models } = ctx;
  const mod = await models.Module.findOne({ organization: orgId, code: 'ST' });
  await models.Module.updateOne({ _id: mod._id }, { $set: { topics: [{ title: 'Untouched', order: 0, subtopics: [] }] } });

  const res = await req('GET', `/modules/${mod._id}/master-syllabus-preview`, SA, null, asOrg());
  assert.equal(res.status, 200);
  assert.equal(res.data.topicCount, 2);
  assert.equal(res.data.subtopicCount, 1);
  assert.equal(res.data.description, 'Master description');
  assert.deepEqual(res.data.topics.map((t) => t.title), ['Topic One', 'Topic Two']);
  assert.equal(res.data.topics[0].subtopics[0].title, 'Sub 1');

  // The preview is read-only — the org module is unchanged.
  const after = await models.Module.findOne({ organization: orgId, code: 'ST' });
  assert.equal(after.topics.length, 1);
  assert.equal(after.topics[0].title, 'Untouched');
});

test('super admin (drilled in) imports the master syllabus onto an org module', async () => {
  const { req, models } = ctx;
  const mod = await models.Module.findOne({ organization: orgId, code: 'ST' });
  assert.ok(mod, 'org cloned the ST module');

  // Simulate the org drifting: wipe its syllabus + description.
  await models.Module.updateOne({ _id: mod._id }, { $set: { topics: [], description: '', learningObjectives: [] } });

  // Also add a NEW topic to the master AFTER the org was created, to prove it syncs the latest.
  await models.Module.updateOne(
    { organization: templateId, code: 'ST' },
    { $push: { topics: { title: 'Topic Three', description: 'T3', order: 2, subtopics: [] } } },
  );

  const res = await req('POST', `/modules/${mod._id}/import-syllabus`, SA, {}, asOrg());
  assert.equal(res.status, 200);
  assert.equal(res.data.description, 'Master description');
  assert.deepEqual(res.data.learningObjectives, ['obj A']);
  assert.equal(res.data.topics.length, 3, 'all master topics (incl. the newly-added one) copied');

  const t1 = res.data.topics.find((t) => t.title === 'Topic One');
  assert.equal(t1.description, 'T1 desc');
  assert.equal(t1.subtopics.length, 1);
  assert.equal(t1.subtopics[0].title, 'Sub 1');
  assert.equal(t1.subtopics[0].description, 'S1 desc');
});

test('a plain org admin cannot import the master syllabus (super-admin only)', async () => {
  const { req, models } = ctx;
  const A = await ctx.login('admin@acme.local');
  const mod = await models.Module.findOne({ organization: orgId, code: 'ST' });
  const res = await req('POST', `/modules/${mod._id}/import-syllabus`, A, {});
  assert.equal(res.status, 403);
});
