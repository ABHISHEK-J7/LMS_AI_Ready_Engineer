import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

/** Build (once) an SMTP transport if credentials are configured. */
function getTransport() {
  if (transporter !== null) return transporter;
  if (!env.mail.host) {
    transporter = false; // no SMTP configured
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.secure, // true for 465, false for 587 (STARTTLS)
    auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
  });
  return transporter;
}

/** Verify the SMTP connection at boot so misconfiguration is obvious in logs. */
export async function verifyMailer() {
  const tx = getTransport();
  if (!tx) {
    // eslint-disable-next-line no-console
    console.warn('[mail] SMTP not configured (SMTP_HOST blank) — OTP emails will be logged to the console in development.');
    return false;
  }
  try {
    await tx.verify();
    // eslint-disable-next-line no-console
    console.log('[mail] SMTP transport verified — ready to send emails.');
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[mail] SMTP verification FAILED: ${err.message}`);
    return false;
  }
}

/**
 * Send an email via the configured SMTP transport. In production an unconfigured
 * mailer is a hard error; in development it logs (no OTP is ever returned to the
 * client).
 */
export async function sendMail({ to, subject, text, html }) {
  const tx = getTransport();
  if (!tx) {
    if (env.isProd) throw new Error('Email service is not configured (set SMTP_HOST and credentials).');
    // eslint-disable-next-line no-console
    console.log(`[mail:dev] To: ${to} | Subject: ${subject}\n${text ?? ''}`);
    return { delivered: false };
  }
  await tx.sendMail({ from: env.mail.from, to, subject, text, html });
  return { delivered: true };
}

// ── Branded OTP email ─────────────────────────────────────────────────────────

const BRAND = {
  name: 'AI Ready Engineer',
  green: '#008738',
  greenDark: '#066b30',
  tint: '#e7f6ee',
  ink: '#101828',
  muted: '#667085',
  line: '#e4e7ec',
  bg: '#f4f6f8',
};

/** Render the OTP email — returns { subject, text, html }. Pure + testable. */
export function renderOtpEmail(otp) {
  const code = String(otp);
  const subject = `${code} is your ${BRAND.name} verification code`;

  const text =
    `${BRAND.name}\n\n` +
    `Your verification code is: ${code}\n\n` +
    `Enter it on the sign-in screen to set your account password. ` +
    `This code expires in 10 minutes.\n\n` +
    `If you didn't request this, you can safely ignore this email.`;

  // Email-safe: table layout + inline styles (no external CSS, no flex/grid).
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid ${BRAND.line};border-radius:16px;overflow:hidden;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,${BRAND.green},${BRAND.greenDark});padding:28px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:44px;height:44px;background:rgba(255,255,255,0.18);border-radius:11px;text-align:center;vertical-align:middle;color:#fff;font-weight:700;font-size:18px;">AI</td>
            <td style="padding-left:14px;color:#fff;font-size:18px;font-weight:700;letter-spacing:0.2px;">${BRAND.name}</td>
          </tr></table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 32px 8px;">
          <h1 style="margin:0 0 8px;color:${BRAND.ink};font-size:22px;font-weight:700;">Verify your email</h1>
          <p style="margin:0 0 24px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
            Use this one-time code to set your password and finish setting up your account.
          </p>

          <!-- Code box -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="background:${BRAND.tint};border:1px solid ${BRAND.green};border-radius:14px;padding:22px;">
              <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:38px;font-weight:700;letter-spacing:12px;color:${BRAND.greenDark};padding-left:12px;">${code}</div>
            </td></tr>
          </table>

          <p style="margin:22px 0 0;text-align:center;">
            <span style="display:inline-block;background:${BRAND.tint};color:${BRAND.greenDark};font-size:13px;font-weight:600;padding:6px 14px;border-radius:999px;">&#9201; Expires in 10 minutes</span>
          </p>
        </td></tr>

        <!-- Divider + note -->
        <tr><td style="padding:28px 32px 0;"><div style="border-top:1px solid ${BRAND.line};"></div></td></tr>
        <tr><td style="padding:18px 32px 32px;">
          <p style="margin:0;color:${BRAND.muted};font-size:13px;line-height:1.6;">
            Didn't request this code? You can safely ignore this email — your account stays secure and no changes are made.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:${BRAND.bg};padding:18px 32px;text-align:center;">
          <p style="margin:0;color:${BRAND.muted};font-size:12px;">${BRAND.name} &middot; Your path from beginner to advanced AI Engineer</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

/** Send a one-time passcode. Throws (caught by caller) if delivery fails in prod. */
export async function sendOtpEmail(to, otp) {
  const { subject, text, html } = renderOtpEmail(otp);
  return sendMail({ to, subject, text, html });
}
