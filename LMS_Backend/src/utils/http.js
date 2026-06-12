/** Wrap an async route so thrown/rejected errors reach the error middleware. */
export function asyncHandler(fn) {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/** Send a success envelope. */
export function ok(res, data, statusCode = 200) {
  const body = { success: true, data };
  return res.status(statusCode).json(body);
}
