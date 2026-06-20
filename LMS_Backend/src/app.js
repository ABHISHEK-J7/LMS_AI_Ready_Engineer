import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { UPLOADS_URL_PREFIX } from './config/storage.js';
import { serveUpload } from './services/fileStore.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { requestId } from './middleware/requestId.js';
import { authenticateFile } from './middleware/fileAuth.js';
import { asyncHandler } from './utils/http.js';
import apiRoutes from './routes/index.js';

export function createApp() {
  const app = express();

  // Behind a reverse proxy (nginx) in production: trust the first hop so the
  // rate limiter sees the real client IP. Do NOT trust proxy in dev, where an
  // attacker could spoof X-Forwarded-For to dodge rate limits.
  if (env.isProd) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Correlation id first, so it's available to every downstream log + error.
  app.use(requestId);

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

  // Serve uploaded files straight from MongoDB/GridFS (before the rate limiter so
  // downloads don't count against the API budget). Authorized via a file-scoped
  // token (`?t=` for media elements, or a Bearer access token for axios), so
  // personal data (proctor snapshots, certificates) is never world-readable. The
  // handler streams with HTTP Range support and re-applies the hardening headers.
  app.get(`${UPLOADS_URL_PREFIX}/:filename`, authenticateFile, asyncHandler(serveUpload));

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
