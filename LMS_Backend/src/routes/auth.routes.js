import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { makeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';
import { env } from '../config/env.js';

const router = Router();

// Brute-force protection on CREDENTIAL endpoints (login/register) only. Counts
// failed attempts per IP; successful ones don't count. Generous so real users
// (and dev/testing) are never locked out — effectively unlimited in dev.
// Redis-backed (shared across replicas) when REDIS_URL is set.
const credentialLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: env.isProd ? 50 : 100000,
  skipSuccessfulRequests: true,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Try again in a few minutes.' } },
});

// Token refresh is token-secured (a signed refresh token can't be brute-forced)
// and fires automatically as users navigate — it must NOT count toward the login
// limit. A high, separate cap just guards against runaway loops.
const refreshLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: env.isProd ? 600 : 100000,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' } },
});

// Stricter cap for OTP requests — prevents mail-bombing an address.
const otpLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: env.isProd ? 8 : 100000,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many code requests. Try again later.' } },
});

router.post('/login', credentialLimiter, validate({ body: auth.loginSchema }), asyncHandler(auth.login));
router.post('/register', credentialLimiter, validate({ body: auth.registerSchema }), asyncHandler(auth.register));
router.post('/refresh', refreshLimiter, validate({ body: auth.refreshSchema }), asyncHandler(auth.refresh));
router.get('/me', authenticate, asyncHandler(auth.me));
router.post('/logout', authenticate, asyncHandler(auth.logout));

// Passwordless onboarding / password reset via email OTP.
router.post('/check-email', refreshLimiter, validate({ body: auth.checkEmailSchema }), asyncHandler(auth.checkEmail));
router.post('/request-otp', otpLimiter, validate({ body: auth.requestOtpSchema }), asyncHandler(auth.requestOtp));
router.post('/verify-otp', credentialLimiter, validate({ body: auth.verifyOtpSchema }), asyncHandler(auth.verifyOtp));
router.post('/set-password', credentialLimiter, validate({ body: auth.setPasswordSchema }), asyncHandler(auth.setPasswordWithToken));

export default router;
