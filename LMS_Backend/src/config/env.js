import 'dotenv/config';

/** Read a required env var, failing fast at boot if it is missing in production. */
function required(key, fallback) {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    // Dev convenience — warn but allow an insecure fallback.
    // eslint-disable-next-line no-console
    console.warn(`[env] ${key} is not set; using an insecure development default.`);
    return fallback ?? `dev-${key.toLowerCase()}`;
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT ?? 5050),
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  // Public base URL of the SPA — used to build certificate verification links / QR codes.
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:5173',
  mongoUri: required('MONGO_URI', 'mongodb://localhost:27017/lms_ai_ready'),
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
  },
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  // AI evaluation engine (LMS_AI_Engine) — Claude API.
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  githubToken: process.env.GITHUB_TOKEN ?? '',
  // Zoom Server-to-Server OAuth (auto-create class meeting links).
  zoomAccountId: process.env.ZOOM_ACCOUNT_ID ?? '',
  zoomClientId: process.env.ZOOM_CLIENT_ID ?? '',
  zoomClientSecret: process.env.ZOOM_CLIENT_SECRET ?? '',
  // Outbound email (password-OTP onboarding). When unset in development, the
  // mailer logs the OTP to the console and the API surfaces it for testing.
  mail: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: String(process.env.SMTP_SECURE ?? '').toLowerCase() === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'AI Ready Engineer <no-reply@aiready.local>',
  },
  seedAdmin: {
    name: process.env.SEED_ADMIN_NAME ?? 'Platform Admin',
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@aiready.local',
    password: process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!',
  },
};
