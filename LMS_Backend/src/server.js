import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { verifyMailer } from './services/mailer.js';
import { startExamMaintenance } from './services/examMaintenance.js';
import { logger, initSentry, captureError } from './utils/logger.js';

async function bootstrap() {
  // Error monitoring first, so failures during the rest of bootstrap are caught.
  await initSentry();
  await connectDatabase();
  const app = createApp();

  // Build indexes before serving so uniqueness guards (e.g. one certificate per
  // student+module) are enforced from the first request. A single index that
  // can't be built (e.g. an existing duplicate in the data) must NOT take the
  // whole server down — log it and keep serving.
  await Promise.all(
    Object.values(mongoose.models).map((m) =>
      m.init().catch((err) => {
        logger.warn(`[server] index build skipped for ${m.modelName}`, { message: err.message });
      }),
    ),
  );

  // Check the SMTP transport up front so a bad mail config is obvious in logs.
  verifyMailer();

  // Periodic exam-engine maintenance: finalize expired attempts + re-drive any
  // grading stuck by a crash. (Swap for a job queue when scaling horizontally.)
  startExamMaintenance();

  const server = app.listen(env.port, () => {
    logger.info(`[server] AI Ready Engineer API listening on http://localhost:${env.port}/api`);
  });

  const shutdown = (signal) => {
    logger.info(`[server] ${signal} received, shutting down...`);
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
    logger.error('[server] Unhandled promise rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
    captureError(reason instanceof Error ? reason : new Error(String(reason)));
  });
  process.on('uncaughtException', (err) => {
    logger.error('[server] Uncaught exception', { message: err.message, stack: err.stack });
    captureError(err);
    server.close(() => process.exit(1));
  });
}

bootstrap().catch((err) => {
  logger.error('[server] Fatal startup error', { message: err.message, stack: err.stack });
  captureError(err);
  process.exit(1);
});
