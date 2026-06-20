/**
 * Load-test target: boots the REAL Express app against an in-memory MongoDB and
 * seeds N students enrolled in one batch, then listens. Used by run.mjs.
 *
 * Running the app against a local (fast) DB isolates the *application-tier*
 * ceiling — i.e. how much a single Node instance can push on one core, including
 * the per-request auth findById. Real Atlas adds network latency on top.
 *
 *   LOADTEST_PORT=5099 LOADTEST_USERS=150 node loadtest/server.mjs
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

const PORT = Number(process.env.LOADTEST_PORT ?? 5099);
const USERS = Number(process.env.LOADTEST_USERS ?? 150);

const mongod = await MongoMemoryServer.create();
process.env.MONGO_URI = mongod.getUri();
process.env.JWT_ACCESS_SECRET = 'loadtest-access';
process.env.JWT_REFRESH_SECRET = 'loadtest-refresh';
process.env.LOG_LEVEL = 'error'; // keep logging out of the hot path

const mongoose = (await import('mongoose')).default;
const { createApp } = await import('../src/app.js');
const models = await import('../src/models/index.js');

await mongoose.connect(process.env.MONGO_URI);
await Promise.all(Object.values(mongoose.models).map((m) => m.init().catch(() => {})));

// Seed: 1 trainer, 1 module, 1 batch, N students (all sharing one real 10-round
// password hash so login still exercises bcrypt.compare at production cost).
const passwordHash = await models.User.setPassword('Passw0rd!');
const trainer = await models.User.create({ name: 'Trainer', email: 'lt-trainer@test.local', role: 'trainer', status: 'active', passwordHash });
const mod = await models.Module.create({ name: 'M', code: 'LT', order: 1, assignedTrainers: [trainer._id], topics: [{ title: 'a', order: 0 }] });
const studentDocs = Array.from({ length: USERS }, (_, i) => ({
  name: `S${i}`, email: `lt-${i}@test.local`, role: 'student', status: 'active', passwordHash,
}));
const students = await models.User.insertMany(studentDocs);
const batch = await models.Batch.create({
  name: 'B', code: 'LTB', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'),
  students: students.map((s) => s._id), trainers: [trainer._id], modules: [mod._id],
});
await models.User.updateMany({ _id: { $in: students.map((s) => s._id) } }, { $set: { batch: batch._id } });

createApp().listen(PORT, () => {
  // run.mjs waits for this line.
  console.log(`LOADTEST_READY port=${PORT} users=${USERS}`);
});
