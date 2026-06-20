import mongoose from 'mongoose';
import { MulterError } from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger, captureError } from '../utils/logger.js';

/** 404 for unmatched routes. */
export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/** Global error handler — converts anything thrown into the standard envelope. */
export function errorHandler(
  err,
  req,
  res,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next,
) {
  let apiError;

  if (err instanceof ApiError) {
    apiError = err;
  } else if (err instanceof mongoose.Error.ValidationError) {
    apiError = ApiError.badRequest('Validation failed', err.errors);
  } else if (err instanceof mongoose.Error.CastError) {
    apiError = ApiError.badRequest(`Invalid ${err.path}: ${String(err.value)}`);
  } else if (err instanceof MulterError) {
    // e.g. LIMIT_FILE_SIZE — a client error, not a server fault.
    apiError = ApiError.badRequest(`Upload error: ${err.message}`);
  } else if (isDuplicateKeyError(err)) {
    apiError = ApiError.conflict('A record with that unique value already exists');
  } else {
    apiError = ApiError.internal(err instanceof Error ? err.message : 'Unknown error');
  }

  if (apiError.statusCode >= 500) {
    logger.error('[error] request failed', {
      requestId: req?.id,
      method: req?.method,
      path: req?.originalUrl,
      status: apiError.statusCode,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    captureError(err, { requestId: req?.id, method: req?.method, path: req?.originalUrl });
  }

  // In production, never leak raw internal exception messages (Mongo/driver/JS
  // errors) to the client — return a generic message; the real one is logged.
  const hideInternals = env.isProd && apiError.statusCode >= 500;
  const body = {
    success: false,
    error: {
      code: apiError.code,
      message: hideInternals ? 'Something went wrong. Please try again.' : apiError.message,
      details: hideInternals ? undefined : apiError.details,
      // Surface the correlation id so a user can quote it in a bug report.
      requestId: req?.id,
    },
  };
  res.status(apiError.statusCode).json(body);
}

function isDuplicateKeyError(err) {
  return typeof err === 'object' && err !== null && err.code === 11000;
}
