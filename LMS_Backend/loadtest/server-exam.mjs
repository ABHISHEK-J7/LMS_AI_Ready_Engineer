/**
 * Load-test target for the "300 students take a proctored exam" scenario. Boots
 * the REAL Express app against in-memory MongoDB, seeds N students in one batch,
 * and an UNLOCKED proctored (app-mode) assessment with 5 MCQs so the submit path
 * grades synchronously (no Anthropic key needed). Used by run-exam.mjs.
 *
 *   LOADTEST_PORT=5099 LOADTEST_USERS=300 node loadtest/server-exam.mjs
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

const PORT = Number(process.env.LOADTEST_PORT ?? 5099);
const USERS = Number(process.env.LOADTEST_USERS ?? 300);

const mongod = await MongoMemoryServer.create();
process.env.MONGO_URI = mongod.getUri();
process.env.JWT_ACCESS_SECRET = 'loadtest-access';
process.env.JWT_REFRESH_SECRET = 'loadtest-refresh';
process.env.LOG_LEVEL = 'error';

const mongoose = (await import('mongoose')).default;
const { createApp } = await import('../src/app.js');
const models = await import('../src/models/index.js');

await mongoose.connect(process.env.MONGO_URI);
await Promise.all(Object.values(mongoose.models).map((m) => m.init().catch(() => {})));

const passwordHash = await models.User.setPassword('Passw0rd!');
const trainer = await models.User.create({ name: 'Trainer', email: 'lt-trainer@test.local', role: 'trainer', status: 'active', passwordHash });
const mod = await models.Module.create({ name: 'M', code: 'LT', order: 1, assignedTrainers: [trainer._id], topics: [{ title: 'a', order: 0 }] });
const students = await models.User.insertMany(
  Array.from({ length: USERS }, (_, i) => ({ name: `S${i}`, email: `lt-${i}@test.local`, role: 'student', status: 'active', passwordHash })),
);
const batch = await models.Batch.create({
  name: 'B', code: 'LTB', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'),
  students: students.map((s) => s._id), trainers: [trainer._id], modules: [mod._id],
});
await models.User.updateMany({ _id: { $in: students.map((s) => s._id) } }, { $set: { batch: batch._id } });

// A proctored (app-mode) exam, UNLOCKED, wide open window, all-MCQ so submit grades
// synchronously without the AI engine.
const questions = Array.from({ length: 5 }, (_, i) => ({
  type: 'mcq', prompt: `Q${i + 1}`, options: ['A', 'B', 'C', 'D'], correctOption: i % 4, points: 1,
}));
const assessment = await models.Assessment.create({
  title: 'Load Exam', module: mod._id, batch: batch._id, type: 'preparation',
  proctoring: 'app', proctored: true, requireSeb: false, durationMinutes: 60,
  availability: 'unlocked',
  availableFrom: new Date(Date.now() - 60 * 60 * 1000),
  deadline: new Date(Date.now() + 6 * 60 * 60 * 1000),
  questions,
});

createApp().listen(PORT, () => {
  console.log(`LOADTEST_READY port=${PORT} users=${USERS} assessment=${assessment._id}`);
});
