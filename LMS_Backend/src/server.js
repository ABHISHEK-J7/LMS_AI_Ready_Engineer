import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';

async function bootstrap() {
  await connectDatabase();
  const app = createApp();

  // Build indexes before serving so uniqueness guards (e.g. one certificate per
  // student+module) are enforced from the first request. A single index that
  // can't be built (e.g. an existing duplicate in the data) must NOT take the
  // whole server down — log it and keep serving.
  await Promise.all(
    Object.values(mongoose.models).map((m) =>
      m.init().catch((err) => {
        // eslint-disable-next-line no-console
        console.warn(`[server] index build skipped for ${m.modelName}: ${err.message}`);
      }),
    ),
  );

  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] AI Ready Engineer API listening on http://localhost:${env.port}/api`);
  });

  const shutdown = (signal) => {
    // eslint-disable-next-line no-console
    console.log(`\n[server] ${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Last-resort safety nets — log and exit so the process manager (Docker /
  // systemd) restarts a clean instance instead of running in a corrupt state.
  process.on('unhandledRejection', (reason) => {
    // eslint-disable-next-line no-console
    console.error('[server] Unhandled promise rejection:', reason);
  });
  process.on('uncaughtException', (err) => {
    // eslint-disable-next-line no-console
    console.error('[server] Uncaught exception:', err);
    server.close(() => process.exit(1));
  });
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
