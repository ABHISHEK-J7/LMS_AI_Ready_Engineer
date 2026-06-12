import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

/**
 * Validate request parts against Zod schemas. On success, replaces the raw
 * values with the parsed/coerced output so handlers get typed, clean data.
 */
export function validate(schemas) {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        // Surface the FIRST specific issue (with its field) so the UI can tell
        // the user exactly what's wrong instead of a generic "Validation failed".
        const issue = err.issues[0];
        const field = issue?.path?.length ? issue.path.join('.') : '';
        const message = issue ? (field ? `${field}: ${issue.message}` : issue.message) : 'Validation failed';
        throw ApiError.badRequest(message, err.flatten());
      }
      throw err;
    }
  };
}
