import mongoose from 'mongoose';
import { MulterError } from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/** 404 for unmatched routes. */
export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/** Global error handler — converts anything thrown into the standard envelope. */
export function errorHandler(
  err,
  _req,
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
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  const body = {
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      details: env.isProd && apiError.statusCode >= 500 ? undefined : apiError.details,
    },
  };
  res.status(apiError.statusCode).json(body);
}

function isDuplicateKeyError(err) {
  return typeof err === 'object' && err !== null && err.code === 11000;
}
