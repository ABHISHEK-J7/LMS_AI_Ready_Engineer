/**
 * Tiny bridge so non-React code (the React Query client) can raise a themed
 * toast. The ToastProvider registers its `error` handler here on mount; the
 * QueryClient's default mutation `onError` calls `emitErrorToast`. This makes
 * every otherwise-silent failed mutation surface feedback to the user.
 */
let handler = null;

export function setToastHandler(fn) {
  handler = fn;
}

export function emitErrorToast(message) {
  if (handler) handler(message);
}
