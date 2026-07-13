import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.mjs';

let ctx, SA, orgId, moduleId, templateId, templateModuleId;

before(async () => {
  ctx = await startTestServer();
  await ctx.mkUser('Super', 'super@x.local', 'super_admin');
  SA = await ctx.login('super@x.local');

  // A master-template org with one module ("MT") holding 3 questions of mixed complexity.
  const template = await ctx.models.Organization.create({ name: 'Master Template', code: 'TEMPLATE', isTemplate: true });
  templateId = template._id;
  const tmod = await ctx.models.Module.create({
    organization: templateId, name: 'Master Mod', code: 'MT', order: 1, level: 'beginner',
    topics: [{ title: 'Alpha', order: 0 }],
  });
  templateModuleId = tmod._id;
  const topicId = tmod.topics[0]._id;
  await ctx.models.QuestionBankItem.insertMany([
    { organization: templateId, module: templateModuleId, topic: topicId, topicTitle: 'Alpha', type: 'mcq', complexity: 'easy', prompt: 'Q easy', options: ['a', 'b'], correctOption: 0, points: 1 },
    { organization: templateId, module: templateModuleId, topic: topicId, topicTitle: 'Alpha', type: 'mcq', complexity: 'hard', prompt: 'Q hard', options: ['a', 'b'], correctOption: 1, points: 1 },
    { organization: templateId, module: templateModuleId, topic: null, topicTitle: '', type: 'scenario', complexity: 'medium', prompt: 'Q scenario', referenceAnswer: 'ref', points: 5 },
  ]);

  // A real org whose module "MT" is a clone (same code) — created by the super admin.
  const org = await ctx.req('POST', '/organizations', SA, { name: 'Acme', code: 'ACME', adminName: 'Acme Admin', adminEmail: 'admin@acme.local', adminPassword: 'Passw0rd!' });
  orgId = org.data.id;
});
after(async () => { await ctx.stop(); });

const asOrg = (token) => ({ 'X-Org-Id': orgId }); // super admin acting inside the org

test('complexity: an org admin creates a question with a complexity tag and filters by it', async () => {
  const A = await ctx.login('admin@acme.local');
  // The org cloned the default curriculum; grab one of its modules to attach a question.
  const mods = await ctx.req('GET', '/modules', A);
  const mid = mods.data[0].id;
  const created = await ctx.req('POST', '/question-bank', A, { module: mid, type: 'mcq', complexity: 'hard', prompt: 'Hard one', options: ['a', 'b'], correctOption: 0 });
  assert.equal(created.status, 201);
  assert.equal(created.data.complexity, 'hard');

  // Filter by complexity.
  const hard = await ctx.req('GET', `/question-bank?module=${mid}&complexity=hard`, A);
  assert.ok(hard.data.length >= 1 && hard.data.every((q) => q.complexity === 'hard'));
  const easy = await ctx.req('GET', `/question-bank?module=${mid}&complexity=easy`, A);
  assert.equal(easy.data.length, 0, 'no easy questions yet');
});

test('import-from-template: super admin (drilled in) copies master questions into the org, filtered', async () => {
  // The org's "MT" module (clone of the template's MT).
  const mtMod = await ctx.models.Module.findOne({ organization: orgId, code: 'MT' });
  assert.ok(mtMod, 'org has a cloned MT module');

  // Import only the HARD questions of this module.
  const imp = await ctx.req('POST', '/question-bank/import-from-template', SA, { module: mtMod._id.toString(), topic: 'all', type: 'all', complexity: 'hard' }, asOrg());
  assert.equal(imp.status, 201);
  assert.equal(imp.data.imported, 1, 'one hard question imported');

  // The imported question now lives in the ORG's bank, on the ORG's module.
  const hardQ = await ctx.models.QuestionBankItem.findOne({ organization: orgId, module: mtMod._id, prompt: 'Q hard' });
  assert.ok(hardQ, 'the hard master question was copied into the org');

  // Re-importing everything adds the remaining 2 and skips the duplicate hard one.
  const impAll = await ctx.req('POST', '/question-bank/import-from-template', SA, { module: mtMod._id.toString(), topic: 'all', type: 'all', complexity: 'all' }, asOrg());
  assert.equal(impAll.data.imported, 2, 'easy + scenario imported');
  assert.equal(impAll.data.skipped, 1, 'the already-present hard one is skipped');
});

test('import-from-template: a plain org admin cannot use it (super-admin only)', async () => {
  const A = await ctx.login('admin@acme.local');
  const mtMod = await ctx.models.Module.findOne({ organization: orgId, code: 'MT' });
  const res = await ctx.req('POST', '/question-bank/import-from-template', A, { module: mtMod._id.toString() });
  assert.equal(res.status, 403);
});

test('import-from-template: imported questions map topic titles onto the org module topics', async () => {
  const mtMod = await ctx.models.Module.findOne({ organization: orgId, code: 'MT' });
  const alpha = await ctx.models.QuestionBankItem.findOne({ organization: orgId, module: mtMod._id, prompt: 'Q easy' });
  assert.ok(alpha);
  assert.equal(alpha.topicTitle, 'Alpha');
  // topic id is the ORG module's own topic id (not the template's).
  const orgTopic = mtMod.topics.find((t) => t.title === 'Alpha');
  assert.equal(String(alpha.topic), String(orgTopic._id));
});
