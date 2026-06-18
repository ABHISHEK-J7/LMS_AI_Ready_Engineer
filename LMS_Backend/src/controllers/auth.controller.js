import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { UserRole, UserStatus } from '#shared';
import { User, getSettings } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';
import {
  signAccessToken,
  signRefreshToken,
  signResetToken,
  verifyRefreshToken,
  verifyResetToken,
} from '../utils/jwt.js';
import { sendOtpEmail } from '../services/mailer.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
// Statuses that may still complete OTP onboarding (suspended/archived may not).
const ONBOARDABLE = [UserStatus.ACTIVE, UserStatus.PENDING];

export const loginSchema = z.object({
  email: z.string().email().max(160),
  password: z.string().min(1).max(128),
});

export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(1000),
});

function toDTO(user) {
  return user.toJSON();
}

function issueTokens(user) {
  const tv = user.tokenVersion ?? 0;
  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role, tv }),
    refreshToken: signRefreshToken({ sub: user.id, role: user.role, tv }),
  };
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.ARCHIVED) {
    throw ApiError.forbidden('Your account is not active. Contact your administrator.');
  }
  if (user.status === UserStatus.PENDING) {
    throw ApiError.forbidden('Your account is awaiting administrator approval.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = issueTokens(user);
  const body = { user: toDTO(user), tokens };
  ok(res, body);
}

/** Public self-registration — only if the admin enabled it. New students start PENDING. */
export async function register(req, res) {
  const settings = await getSettings();
  if (!settings.allowSelfRegistration) {
    throw ApiError.forbidden('Self-registration is disabled. Contact your administrator.');
  }
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('An account with that email already exists');

  const passwordHash = await User.setPassword(password);
  const user = await User.create({
    name,
    email,
    passwordHash,
    role: UserRole.STUDENT,
    status: UserStatus.PENDING,
  });
  ok(res, { user: toDTO(user) }, 201);
}

export async function refresh(req, res) {
  const { refreshToken } = req.body;
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }
  const user = await User.findById(payload.sub);
  if (!user || user.status !== UserStatus.ACTIVE) {
    throw ApiError.unauthorized('Account is no longer active');
  }
  // Reject refresh tokens issued before the user's tokenVersion was bumped
  // (logout / password change / suspension revokes all older sessions).
  if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) {
    throw ApiError.unauthorized('Session expired — please sign in again');
  }
  ok(res, { tokens: issueTokens(user) });
}

/** Revoke all of this user's refresh tokens (sign-out everywhere). */
export async function logout(req, res) {
  await User.updateOne({ _id: req.auth.userId }, { $inc: { tokenVersion: 1 } });
  ok(res, { ok: true });
}

export async function me(req, res) {
  const user = await User.findById(req.auth.userId);
  if (!user) throw ApiError.notFound('User not found');
  ok(res, { user: toDTO(user) });
}

// ── Passwordless onboarding / password reset via email OTP ──────────────────

export const checkEmailSchema = z.object({ email: z.string().email().max(160) });
export const requestOtpSchema = z.object({ email: z.string().email().max(160) });
export const verifyOtpSchema = z.object({
  email: z.string().email().max(160),
  otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});
export const setPasswordSchema = z.object({
  resetToken: z.string().min(10).max(1000),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

/** Generate a 6-digit numeric OTP as a string. */
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Tell the login screen whether an email exists and whether it already has a
 * password — so it can offer "enter password" vs "set password via OTP".
 */
export async function checkEmail(req, res) {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash status');
  const usable = user && ONBOARDABLE.includes(user.status);
  ok(res, { exists: Boolean(usable), hasPassword: Boolean(usable && user.passwordHash) });
}

/**
 * Send a one-time passcode to the email. Always responds success (so it can't
 * be used to enumerate accounts); only actually mails when the account exists
 * and is onboardable. In dev (no SMTP) the OTP is returned for testing.
 */
export async function requestOtp(req, res) {
  const user = await User.findOne({ email: req.body.email });
  if (!user || !ONBOARDABLE.includes(user.status)) {
    ok(res, { sent: true }); // don't reveal whether the email exists
    return;
  }
  const otp = generateOtp();
  user.otpHash = await bcrypt.hash(otp, 10);
  user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  user.otpAttempts = 0;
  await user.save();

  try {
    await sendOtpEmail(user.email, otp);
  } catch (err) {
    // Never reveal delivery failures to the client (it would leak that the
    // email exists). Surface it in logs so an admin can fix SMTP config.
    // eslint-disable-next-line no-console
    console.error(`[auth] failed to send OTP email to ${user.email}: ${err.message}`);
  }
  ok(res, { sent: true });
}

/**
 * Verify the OTP. On success, return a short-lived reset token authorizing one
 * password set. Wrong/expired codes are throttled to OTP_MAX_ATTEMPTS.
 */
export async function verifyOtp(req, res) {
  const { email, otp } = req.body;
  const user = await User.findOne({ email }).select('+otpHash +otpExpiresAt +otpAttempts status');
  const invalid = ApiError.badRequest('Invalid or expired code');

  if (!user || !user.otpHash || !user.otpExpiresAt) throw invalid;
  if (user.otpExpiresAt.getTime() < Date.now()) throw invalid;
  if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
    throw ApiError.badRequest('Too many attempts. Request a new code.');
  }

  const match = await bcrypt.compare(otp, user.otpHash);
  if (!match) {
    user.otpAttempts += 1;
    await user.save();
    throw invalid;
  }

  // Consume the OTP; issue a one-shot reset token.
  user.otpHash = undefined;
  user.otpExpiresAt = undefined;
  user.otpAttempts = 0;
  await user.save();
  ok(res, { resetToken: signResetToken(user.id) });
}

/** Set the password using a reset token from verifyOtp, then send to login. */
export async function setPasswordWithToken(req, res) {
  const { resetToken, password } = req.body;
  let payload;
  try {
    payload = verifyResetToken(resetToken);
  } catch {
    throw ApiError.unauthorized('This link has expired. Please request a new code.');
  }
  const user = await User.findById(payload.sub);
  if (!user || !ONBOARDABLE.includes(user.status)) throw ApiError.notFound('Account not found');

  user.passwordHash = await User.setPassword(password);
  if (user.status === UserStatus.PENDING) user.status = UserStatus.ACTIVE;
  user.otpHash = undefined;
  user.otpExpiresAt = undefined;
  user.otpAttempts = 0;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1; // a password set revokes old sessions
  await user.save();
  ok(res, { ok: true });
}
