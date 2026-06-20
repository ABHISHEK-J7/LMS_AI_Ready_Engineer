/**
 * One-off data hygiene: remove references to users that no longer exist
 * (e.g. after a users-collection wipe). Pulls dead user ids out of batch
 * students/trainers/module-trainer maps and module assignedTrainers, so list
 * pages don't render null members. Idempotent + safe to re-run.
 *
 *   node scripts/cleanup-orphans.mjs            (dry run — reports only)
 *   node scripts/cleanup-orphans.mjs --apply    (writes the changes)
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Batch, Module, User } from '../src/models/index.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  await mongoose.connect(env.mongoUri);
  const ids = new Set((await User.find({}).select('_id').lean()).map((u) => String(u._id)));
  const alive = (arr = []) => arr.filter((x) => ids.has(String(x)));
  let batchesFixed = 0;
  let modulesFixed = 0;

  for (const b of await Batch.find({})) {
    const before = JSON.stringify([b.students, b.trainers, b.moduleTrainers]);
    b.students = alive(b.students);
    b.trainers = alive(b.trainers);
    if (Array.isArray(b.moduleTrainers)) {
      for (const mt of b.moduleTrainers) mt.trainers = alive(mt.trainers);
    }
    if (JSON.stringify([b.students, b.trainers, b.moduleTrainers]) !== before) {
      batchesFixed += 1;
      console.log(`[orphans] batch ${b.code || b._id}: students=${b.students.length} trainers=${b.trainers.length}`);
      if (APPLY) await b.save();
    }
  }

  for (const m of await Module.find({})) {
    const before = m.assignedTrainers.length;
    m.assignedTrainers = alive(m.assignedTrainers);
    if (m.assignedTrainers.length !== before) {
      modulesFixed += 1;
      console.log(`[orphans] module ${m.code || m._id}: assignedTrainers ${before} → ${m.assignedTrainers.length}`);
      if (APPLY) await m.save();
    }
  }

  console.log(`\n[orphans] ${APPLY ? 'APPLIED' : 'DRY RUN'} — ${batchesFixed} batch(es), ${modulesFixed} module(s) would be cleaned.`);
  if (!APPLY) console.log('[orphans] re-run with --apply to write the changes.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[orphans] fatal:', err);
  process.exit(1);
});
