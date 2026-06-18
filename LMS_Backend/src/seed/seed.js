/**
 * Idempotent seed: ensures the global settings doc, a default admin account,
 * and the default AI Ready Engineer curriculum (10 modules) exist.
 *
 *   npm run seed   (from LMS_Backend)
 */
import { DEFAULT_CURRICULUM, UserRole, UserStatus } from '#shared';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { Module, User, getSettings } from '../models/index.js';

async function seed() {
  await connectDatabase();

  // 1. Settings singleton
  await getSettings();
  console.log('[seed] settings ensured');

  // 2. Default admin
  const existingAdmin = await User.findOne({ email: env.seedAdmin.email });
  if (existingAdmin) {
    console.log(`[seed] admin already exists: ${env.seedAdmin.email}`);
  } else {
    const passwordHash = await User.setPassword(env.seedAdmin.password);
    await User.create({
      name: env.seedAdmin.name,
      email: env.seedAdmin.email,
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });
    console.log(`[seed] created admin: ${env.seedAdmin.email} / ${env.seedAdmin.password}`);
  }

  // 3. Default curriculum
  for (const m of DEFAULT_CURRICULUM) {
    const exists = await Module.findOne({ code: m.code });
    if (exists) {
      console.log(`[seed] module ${m.code} exists, skipping`);
      continue;
    }
    await Module.create({
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
