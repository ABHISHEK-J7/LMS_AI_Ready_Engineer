/**
 * Idempotent seed + multi-tenant migration. Ensures:
 *   - the global settings doc,
 *   - a global SUPER ADMIN (no organization),
 *   - a "Default Organization" that owns all pre-existing data,
 *   - a default org admin + the default AI-Ready-Engineer curriculum for it,
 * and BACKFILLS `organization` onto every tenant document that predates orgs.
 *
 *   npm run seed   (from LMS_Backend)
 */
import { DEFAULT_CURRICULUM, UserRole, UserStatus } from '#shared';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import * as models from '../models/index.js';
import { getSettings, Module, Organization, User } from '../models/index.js';

// Every tenant-scoped collection that must carry `organization`.
const TENANT_MODELS = [
  'Module', 'Batch', 'Assessment', 'QuestionBankItem', 'Resource', 'Submission',
  'Attendance', 'Announcement', 'Doubt', 'Certificate', 'ExternalCertificate',
  'ClassSchedule', 'ClassJoin', 'ClassRating', 'ModuleProgress', 'Project',
  'Notification', 'AuditLog', 'Settings',
];

async function seed() {
  if (env.isProd && (process.env.SEED_ADMIN_PASSWORD ?? '') === '') {
    throw new Error('Refusing to seed in production without an explicit SEED_ADMIN_PASSWORD env var.');
  }
  await connectDatabase();

  // 1. Settings singleton
  await getSettings();
  console.log('[seed] settings ensured');

  // 2. Global super admin (organization = null)
  let superAdmin = await User.findOne({ role: UserRole.SUPER_ADMIN });
  if (!superAdmin) {
    superAdmin = await User.create({
      name: env.seedSuperAdmin.name,
      email: env.seedSuperAdmin.email,
      passwordHash: await User.setPassword(env.seedSuperAdmin.password),
      role: UserRole.SUPER_ADMIN,
      organization: null,
      status: UserStatus.ACTIVE,
    });
    console.log(`[seed] created SUPER ADMIN: ${superAdmin.email}`);
  } else {
    console.log(`[seed] super admin exists: ${superAdmin.email}`);
  }

  // 3. Default organization (owns all legacy data)
  let org = await Organization.findOne({ code: 'DEFAULT' });
  if (!org) {
    org = await Organization.create({ name: 'Default Organization', code: 'DEFAULT', createdBy: superAdmin._id });
    console.log('[seed] created Default Organization');
  }

  // 4. Backfill organization on every legacy tenant document that lacks one.
  for (const name of TENANT_MODELS) {
    const Model = models[name];
    if (!Model) continue;
    const r = await Model.updateMany(
      { $or: [{ organization: null }, { organization: { $exists: false } }] },
      { $set: { organization: org._id } },
    );
    if (r.modifiedCount) console.log(`[seed] backfilled ${r.modifiedCount} ${name} -> Default Organization`);
  }
  // Users too (except the super admin, who stays global).
  const ur = await User.updateMany(
    { role: { $ne: UserRole.SUPER_ADMIN }, $or: [{ organization: null }, { organization: { $exists: false } }] },
    { $set: { organization: org._id } },
  );
  if (ur.modifiedCount) console.log(`[seed] backfilled ${ur.modifiedCount} users -> Default Organization`);

  // 5. Default org admin
  const existingAdmin = await User.findOne({ email: env.seedAdmin.email });
  if (existingAdmin) {
    if (!existingAdmin.organization) { existingAdmin.organization = org._id; await existingAdmin.save(); }
    console.log(`[seed] admin exists: ${env.seedAdmin.email}`);
  } else {
    await User.create({
      name: env.seedAdmin.name,
      email: env.seedAdmin.email,
      passwordHash: await User.setPassword(env.seedAdmin.password),
      role: UserRole.ADMIN,
      organization: org._id,
      status: UserStatus.ACTIVE,
    });
    console.log(`[seed] created admin: ${env.seedAdmin.email} (Default Organization)`);
  }

  // 6. Default curriculum for the Default Organization
  for (const m of DEFAULT_CURRICULUM) {
    if (await Module.findOne({ organization: org._id, code: m.code })) continue;
    await Module.create({
      organization: org._id,
      name: m.name,
      code: m.code,
      order: m.order,
      level: m.level,
      learningObjectives: [],
      topics: m.topics.map((title, i) => ({ title, order: i, completed: false })),
      assignedTrainers: [],
      archived: false,
    });
    console.log(`[seed] created module ${m.code} — ${m.name}`);
  }

  await disconnectDatabase();
  console.log('[seed] done');
}

seed().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
