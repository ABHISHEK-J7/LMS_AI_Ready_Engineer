import { api, unwrap } from './api';

/** Does this email exist, and does it already have a password? */
export function checkEmail(email) {
  return unwrap(api.post('/auth/check-email', { email }));
}

/** Request a one-time code by email. Resolves with { sent, devOtp? }. */
export function requestOtp(email) {
  return unwrap(api.post('/auth/request-otp', { email }));
}

/** Verify the code. Resolves with { resetToken } on success. */
export function verifyOtp(email, otp) {
  return unwrap(api.post('/auth/verify-otp', { email, otp }));
}

/** Set a new password using the reset token from verifyOtp. */
export function setPassword(resetToken, password) {
  return unwrap(api.post('/auth/set-password', { resetToken, password }));
}
