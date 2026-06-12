import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { ensureUploadsDir, UPLOADS_URL_PREFIX } from './config/storage.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import apiRoutes from './routes/index.js';

export function createApp() {
  const app = express();

  // Behind a reverse proxy (nginx) in production: trust the first hop so the
  // rate limiter sees the real client IP. Do NOT trust proxy in dev, where an
  // attacker could spoof X-Forwarded-For to dodge rate limits.
  if (env.isProd) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  // Strip MongoDB operator keys ($, .) from body/query/params — defends against
  // NoSQL operator injection (e.g. {"password": {"$ne": null}}).
  app.use(mongoSanitize());
  if (!env.isProd) app.use(morgan('dev'));

  // Serve uploaded learning resources (before the rate limiter so downloads
  // don't count against the API budget). Files live in LMS_Storage/uploads.
  app.use(UPLOADS_URL_PREFIX, express.static(ensureUploadsDir()));

  // Basic abuse protection on the API surface.
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 1000,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
