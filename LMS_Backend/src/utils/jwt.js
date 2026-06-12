import jwt from 'jsonwebtoken';
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL } from '@lms/shared';
import { env } from '../config/env.js';

export function signAccessToken(payload) {
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: ACCESS_TOKEN_TTL });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: REFRESH_TOKEN_TTL });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

// Short-lived token issued after a successful OTP check, authorizing exactly one
// password set. Scoped with a `typ` claim so it can't be used as an access token.
export function signResetToken(userId) {
  return jwt.sign({ sub: userId, typ: 'pwd_reset' }, env.jwt.accessSecret, { expiresIn: '10m' });
}

export function verifyResetToken(token) {
  const payload = jwt.verify(token, env.jwt.accessSecret);
  if (payload.typ !== 'pwd_reset') throw new Error('Not a password-reset token');
  return payload;
}
