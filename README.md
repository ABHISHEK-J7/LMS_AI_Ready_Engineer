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

## Status

Foundation milestone: monorepo, shared design system + types, backend scaffold with
auth/RBAC and core data models, frontend design system with themed UI components and
role dashboard shells. Feature modules build on top of this. See
`LMS_Documentation/ROADMAP.md`.
