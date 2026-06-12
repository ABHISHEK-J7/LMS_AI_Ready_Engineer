import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

/** Build (once) an SMTP transport if credentials are configured. */
function getTransport() {
  if (transporter !== null) return transporter;
  if (!env.mail.host) {
    transporter = false; // no SMTP configured — dev fallback mode
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.secure,
    auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
  });
  return transporter;
}

/**
 * Send an email. Returns `{ delivered: boolean }`. When no SMTP is configured
 * (typical in development), it logs instead of throwing so flows still work.
 */
export async function sendMail({ to, subject, text, html }) {
  const tx = getTransport();
  if (!tx) {
    // eslint-disable-next-line no-console
    console.log(`[mail:dev] To: ${to}\n[mail:dev] Subject: ${subject}\n[mail:dev] ${text ?? ''}`);
    return { delivered: false };
  }
  await tx.sendMail({ from: env.mail.from, to, subject, text, html });
  return { delivered: true };
}

/**
 * Send a one-time passcode. Returns `{ delivered }`; in non-production, also
 * returns `devOtp` when email wasn't actually delivered so the UI/tests can
 * proceed without a real mailbox.
 */
export async function sendOtpEmail(to, otp) {
  const subject = 'Your AI Ready Engineer verification code';
  const text =
    `Your verification code is ${otp}.\n\n` +
    `It expires in 10 minutes. Enter it to set your account password.\n\n` +
    `If you did not request this, you can ignore this email.`;
  const html =
    `<p>Your verification code is:</p>` +
    `<p style="font-size:28px;font-weight:700;letter-spacing:4px">${otp}</p>` +
    `<p>It expires in 10 minutes. Enter it to set your account password.</p>` +
    `<p style="color:#888">If you did not request this, you can ignore this email.</p>`;
  const { delivered } = await sendMail({ to, subject, text, html });
  return { delivered, devOtp: !delivered && !env.isProd ? otp : undefined };
}
