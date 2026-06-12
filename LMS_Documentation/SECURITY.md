# Security

How the AI Ready Engineer platform protects data and access, plus a production checklist.

## Authentication & authorization
- **JWT** access (15 min) + refresh (7 days) tokens; secrets from env, and the server
  **refuses to boot in production** if `JWT_*` secrets are unset.
- **Role-based access control** on every route (`requireRole`) — Student / Trainer / Admin.
  Ownership checks beyond role where needed (a trainer may only manage modules/batches/classes/
  assessments/doubts they're assigned to; a student only their own data).
- Passwords hashed with **bcrypt**; `passwordHash` is `select:false` and stripped from all JSON.
- **Brute-force protection**: auth endpoints (`/login`, `/register`, `/refresh`) are rate-limited
  to 20 attempts / 15 min per IP (successful logins don't count).

## Input handling
- **Zod validation** on every request body / query / params; lengths capped (names, emails,
  passwords ≤128, search ≤100) to bound payloads and avoid bcrypt abuse.
- **NoSQL operator-injection** defense: `express-mongo-sanitize` strips `$`/`.` keys from all
  inputs, and Zod rejects object-shaped values where strings are expected.
- **Regex injection / ReDoS**: user-supplied search is regex-escaped before use.
- Mongoose `CastError`/`ValidationError` and Multer errors map to clean **400s**, never 500 leaks.

## File uploads
- Uploads go to `LMS_Storage/uploads` via Multer with a **type allowlist** (docs/images/video/
  archives only — executables/scripts/HTML rejected), a **100 MB** cap, and **sanitized,
  randomized filenames**. Served as static assets (no execution).

## Transport & headers
- **Helmet** sets secure headers; `x-powered-by` disabled; HSTS in production.
- **nginx** (frontend image) adds a strict **Content-Security-Policy**, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, and `Referrer-Policy`.
- **CORS** restricted to the configured origin(s).
- `trust proxy` is enabled **only in production** (behind nginx) so rate-limiting sees the real
  client IP without allowing `X-Forwarded-For` spoofing in dev.

## Secrets
- Real secrets live only in `.env` / compose `.env`, both **git-ignored**. Committed `*.example`
  files contain **placeholders only**. The root `.dockerignore` keeps `.env*` out of images.
- The Claude API key can be set via `ANTHROPIC_API_KEY` (preferred) **or** admin Settings; when
  stored in Settings it is `select:false`, **never returned** by the API (exposed as a boolean),
  and write-only in the UI. The env var always takes precedence.

## Resilience
- Process-level `uncaughtException` / `unhandledRejection` handlers + graceful shutdown, so a
  process manager (Docker/systemd) restarts a clean instance.
- Backend container runs as the **non-root** `node` user; backend/mongo aren't published to the
  host (only the frontend port is).

## Production checklist
- [ ] Generate strong, unique `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`.
- [ ] **Change the seeded admin password** (`admin@aiready.local` / `ChangeMe123!`) immediately.
- [ ] Set `NODE_ENV=production` and a real `APP_BASE_URL` / `CORS_ORIGIN` (https).
- [ ] Terminate **TLS** at a proxy/LB in front of the frontend.
- [ ] Use a locked-down MongoDB (auth + network rules); rotate any exposed DB password.
- [ ] Keep `ANTHROPIC_API_KEY` in env/secret manager (not the DB) for prod.
- [ ] Run `npm audit` and patch; keep base images updated.

## Dependency posture
- Production runtime trees are clean. The only remaining `npm audit` findings are **2 moderate,
  dev-only** advisories in `esbuild` (used by the Vite **dev server**). They do **not** ship to
  production — the frontend image contains pre-built static assets served by nginx (no esbuild/
  Vite at runtime), and the backend image installs with `--omit=dev`. Bumping is a Vite major; do
  it on the next maintenance pass. (The earlier critical `shell-quote`/`concurrently` chain was
  removed entirely.)
