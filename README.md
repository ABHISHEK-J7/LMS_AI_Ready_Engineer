# AI Ready Engineer — LMS Platform

A complete **AI Engineering College & Training Institute Management System**: structured
AI-engineering curriculum, daily trainer-led online classes, manual attendance, batch
management, trainer-unlocked assessments, AI-powered prompt/project evaluation, and
automatic certification.

> This is **not** a public course marketplace. Access is restricted to enrolled students
> managed by administrators. Roles: **Student**, **Trainer**, **Admin**.

## Architecture (monorepo · npm workspaces)

| Folder | Purpose | Stack |
| --- | --- | --- |
| `LMS_Backend` | REST API, auth, business logic, AI evaluation engine, **GridFS file storage** | Node · Express · Mongoose (MongoDB) · JavaScript (ESM) |
| `LMS_Frontend` | Single SPA for students & trainers (role-based routing) | React · Vite · JavaScript (JSX) |
| `LMS_Admin` | Admin console SPA | React · Vite · JavaScript (JSX) |

Shared domain enums/constants and the centralized design-system tokens live inside each
app under `src/shared/`. All uploaded files (avatars, learning resources/videos, project
shots, certificates, proctor snapshots) are stored **in MongoDB via GridFS** and served
through `/api/uploads/:filename` — there is no on-disk upload directory.

## Theme system

The platform supports **exactly two** official themes, each with light + dark mode:

- **AI Ready Green** (default) — primary `#008738`
- **AI Ready Orange** — primary `#F15D27`

Design tokens live in each app under `src/shared/theme` and are consumed app-wide. No
module may introduce its own colors.

## Getting started

```bash
# from repo root
npm install                 # installs all workspaces (no build step — plain JS)

# configure backend env
cp LMS_Backend/.env.example LMS_Backend/.env   # then edit MONGO_URI, JWT_SECRET, etc.

npm run seed                # create the admin account + default curriculum (needs MongoDB)

# run everything (backend :5050 + frontend :5173)
npm run dev
```

> Codebase is plain JavaScript (ESM). The `@lms/shared` package is consumed directly
> from source — there is no compile step. `LMS_Frontend` builds via Vite (`npm run build`).

You need a running MongoDB (local `mongodb://localhost:27017/lms_ai_ready` or Atlas).

## Roles & access

| Role | Highlights |
| --- | --- |
| **Student** | Assigned batch, daily classes, videos/materials, trainer-unlocked assessments, progress, attendance %, certificates |
| **Trainer** | Assigned modules & batches, syllabus management, manual attendance entry, class scheduling, unlock/lock assessments, analytics |
| **Admin** | Full management of users, modules, batches, schedules, curriculum, certificates, configurable rules (passing score, min attendance) |

## Production notes

Read before deploying:

- **Run the backend as a SINGLE instance** (for now). The API rate limiter and the
  exam-maintenance sweeper are in-process; running multiple replicas multiplies the
  effective rate limits and duplicates the sweeper (risking double-grading). Move the
  limiter to a shared store (Redis) + elect a single sweeper leader before scaling out.
- **Timezone:** class times and exam windows are interpreted in the **server's local
  timezone**. Set `TZ` explicitly on the backend host/container (e.g. `TZ=Asia/Kolkata`)
  to match your operating region, or class/attendance/exam-window times can read wrong.
- **File storage** lives in MongoDB/GridFS (no disk, no CDN). Fine at small scale; for
  high-volume video, migrate large media to object storage + CDN.
- **Required env in production** (the server refuses to boot without them): `MONGO_URI`,
  `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`. See `LMS_Backend/.env.example` for the full
  list (SMTP, AI, Zoom, LiveKit, logging, retention). Never commit a real `.env`.
- **Seeding in prod** requires an explicit `SEED_ADMIN_PASSWORD` (the default-credential
  admin is refused when `NODE_ENV=production`).
- **One-off maintenance scripts** (run from `LMS_Backend/`):
  - `node scripts/cleanup-orphans.mjs [--apply]` — drop references to deleted users from
    batches/modules (run after any bulk user deletion to keep list pages clean).
  - `node scripts/migrate-uploads-to-gridfs.mjs` — import any legacy on-disk uploads.
- **Health/readiness:** `GET /api/health` returns **503** when the DB is down (200 when
  healthy) — wire your load balancer's health check to the HTTP status.
- **Deployment** is containerized in [`LMS_Deployment/`](LMS_Deployment/README.md):
  `docker compose up -d --build` runs a Node **backend** + an **nginx** container that
  serves both built SPAs and proxies `/api` (incl. `/api/uploads`) to the backend
  (student/trainer app on `:80`, admin on `:8080`). Put a TLS terminator in front for HTTPS.
- **File access is authenticated:** uploaded files (proctor snapshots, certificates,
  project shots, avatars) are served only with a valid file-scoped token — never public.

## Tests

- Backend: `npm test --workspace LMS_Backend` (Node test runner + in-memory MongoDB — authz,
  exam engine, progression, syllabus, GridFS upload/serve, LiveKit token authz, GDPR).
- Frontend: `npm test --workspace LMS_Frontend` (Vitest smoke tests for UI primitives).
- CI runs both + builds both apps on every push/PR.

## Status

Foundation milestone: monorepo, shared design system + types, backend scaffold with
auth/RBAC and core data models, frontend design system with themed UI components and
role dashboard shells. Feature modules build on top of this.
