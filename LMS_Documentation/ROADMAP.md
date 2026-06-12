# Build Roadmap

## ✅ Announcements + Notifications + Recurring scheduling (done)

- **Announcements** (`/api/announcements`): `Announcement` model (author, batch?/module?/global);
  trainer/admin post (trainer scoped to assigned batches/modules; admin can post global), role-aware
  feed (student sees their batch + batch's modules + global; trainer sees own+assigned+global; admin
  all), author/admin delete. `AnnouncementsPage` (role-aware post/list) + nav for all roles.
- **Notifications**: global `ToastProvider`/`useToast` (themed toasts) wired into key actions; a
  **`NotificationsBell`** in the topbar shows unread announcement count (localStorage last-seen) with
  a dropdown + "View all".
- **Recurring scheduling**: `POST /classes/recurring` (daysOfWeek + date range → bulk create, ≤60
  occurrences, reuses class auth + optional per-occurrence Zoom). ClassModal gained a **"Repeat
  weekly"** option (weekday picker + repeat-until date).
- Verified: **14/14** integration checks (announcement RBAC + batch/module/global scoping + delete
  auth; recurring count Mon+Wed×2wks=4, unassigned-trainer 403, no-matching-day 400); full build green.

## ✅ Zoom meeting integration (done)

- Real **Zoom Server-to-Server OAuth** integration (`services/meetings.js`): cached token, scheduled
  `createZoomMeeting`, `verifyZoom`, env→Settings credential resolution. Admin configures creds in
  **Settings → Zoom** (masked/write-only like the AI key) or via `ZOOM_*` env; **Test connection** button.
- Scheduling a class with provider **Zoom** + "Auto-create meeting" generates the join link via the
  Zoom API (graceful 400 if unconfigured; manual links still honored). Google Meet / MS Teams stay
  manual (their APIs need per-user OAuth consent, not automatable headless).
- Verified with mocked `fetch`: **8/8** checks (OAuth token + meeting create, auto-link duration/topic,
  unconfigured→400, masked+persisted creds, manual-link respected).

## ✅ Hardening + gap-closure pass (done)

- **Security**: NoSQL operator-injection sanitization (`express-mongo-sanitize`); auth brute-force
  rate limiter (20/15min, success-skipping); regex-escaped user search (ReDoS); input length caps;
  upload type-allowlist + size + sanitized names; `x-powered-by` off + prod `trust proxy`; body
  limits; process-level error handlers; Multer/Mongoose errors → 400. Secrets: `*.example` are
  placeholders only; `.dockerignore` keeps `.env*` out of images. Removed the `concurrently` dev
  tool → cleared the critical `shell-quote` advisory (only 2 dev-only moderate `esbuild` findings
  remain — not in the prod runtime). Full measures + prod checklist in `SECURITY.md`.
- **Deployment** (`LMS_Deployment`): non-root backend Dockerfile (healthchecked), Vite→nginx
  frontend Dockerfile, `nginx.conf` (SPA + `/api` proxy + CSP/security headers), `docker-compose.yml`
  (mongo+backend+frontend, secrets via compose `.env`), `.dockerignore`, README.
- **Gap closure**: admin-configurable **Claude API key in Settings** (masked/write-only, engine
  reads Settings→env, "Test connection" button + endpoint); admin **per-student progress drill-down**
  (`/app/students/:id`, linked from Users); **calendar month-view** + **.ics timetable export** on
  Schedule; deleted the dead `Placeholder.jsx` (no placeholders remain). Added a **Doubts/Q&A**
  feature earlier (student ask / trainer answer) — closing the last spec capability.
- Verified: **14/14** security+features integration checks (operator-injection blocked, regex-safe
  search, brute-force 429, AI-key masked/persisted/engine-pickup, drill-down RBAC); full build green;
  backend connected to Atlas.

## ✅ Milestone 0 — Foundation (done)

- Monorepo (npm workspaces): `LMS_Shared`, `LMS_Backend`, `LMS_Frontend`, `LMS_AI_Engine`.
- **Shared**: domain enums, DTO contracts, default curriculum (10 modules), platform
  constants, and the centralized two-theme design system.
- **Backend** (Express + Mongoose, plain JS/ESM): config (env/db), error handling, Zod
  validation, JWT auth with refresh, role-based access control, and data models for User,
  Module, Batch, ClassSchedule, Attendance, Assessment, Submission, Resource, Certificate,
  ModuleProgress, Settings. Auth + admin user-management endpoints live. Seed script for
  the admin account + default curriculum. Dev: `node --watch src/server.js`.
- **Frontend** (React + Vite, plain JS/JSX): ThemeProvider (both themes, light/dark), UI
  primitives, axios client with token refresh, Zustand auth store, role-based sidebar +
  routing, login, and Student/Trainer/Admin dashboard shells.

> The codebase is plain JavaScript (ESM) — no TypeScript, no compile step. `@lms/shared`
> is consumed directly from source.

Verified: `npm run build` (frontend/Vite) passes; API boots and serves `/api/health`.

## ✅ Milestone 1 — Module & curriculum management (done)

- **API** (`/api/modules`): role-aware list (admin=all, trainer=assigned, student=active),
  get, admin CRUD (create/update/archive/reorder), trainer assignment (two-way sync with
  `User.assignedModules`), and syllabus editing — topics add/update/delete, per-topic
  completion toggle (the trainer-controlled gate), and learning objectives. Authorization:
  admin full; trainer limited to modules they're assigned to (enforced in `loadModuleForEdit`).
- **UI**: `ModulesPage` (role-aware list, admin create/edit/archive + show-archived) and
  `ModuleDetailPage` (syllabus editor with completion checkboxes, objectives editor, admin
  trainer-assignment panel). New design-system primitives: `Modal`, `Select`, `Textarea`,
  table styles. React-query hooks in `lib/modules.js`. Routes `/app/modules`,
  `/app/modules/:id`, `/app/curriculum` wired.
- **Fixed**: embedded subdocuments (`module.topics`, assessment `questions`) now serialize
  `_id`→`id` via `subSchemaOptions` (parent `toJSON` doesn't cascade to subschemas).
- Verified end-to-end against in-memory MongoDB: **17/17** integration checks pass
  (CRUD, RBAC 403s, duplicate-code 409, assignment, completion, archive filtering).

## ✅ Milestone 2 — Batch management (done)

- **API** (`/api/batches`): role-aware list (admin=all, trainer=assigned, student=own batch),
  get (populated students/trainers/modules), admin CRUD (create/update/archive) with
  date-range validation and unique codes, and membership management:
  - **Students** — assign/remove with two-way `User.batch` sync; a student belongs to exactly
    one batch, so assigning auto-removes them from any previous batch.
  - **Trainers** — assign/remove, synced with `User.assignedBatches` (many-to-many).
  - **Modules** — assign/remove the curriculum a batch runs.
- **UI**: `BatchesPage` (status-aware cards: Upcoming/Active/Completed/Archived, counts,
  admin create/edit/archive) and `BatchDetailPage` (reusable `AssignPanel` for students,
  trainers, modules + edit-details modal). Hooks in `lib/batches.js`, shared `lib/users.js`
  (`useStudents`/`useTrainers`), `lib/format.js` date helpers. Routes `/app/batches`,
  `/app/batches/:id`.
- Verified end-to-end against in-memory MongoDB: **21/21** checks (CRUD, RBAC, dup-code 409,
  bad-date 400, student move-between-batches, two-way sync, role-scoped listing, archive filter).

## ✅ Milestone 3 — Class scheduling (done)

- **API** (`/api/classes`): role-aware list (admin=all, trainer=own + assigned-batch classes,
  student=own-batch classes) with filters (batch/module/trainer/status/date-range), get,
  create, update (incl. status lifecycle + meeting/recording links), admin delete.
  - **Create authorization**: admins may schedule for any trainer (trainer required); a
    trainer is forced as the class trainer and must be assigned to the target batch.
  - **Manage authorization**: admin, or the owning trainer only. Time validation (`start < end`).
- **UI**: `SchedulePage` — Upcoming/All tabs, sessions grouped by day with time, status badge,
  module/batch/trainer/provider, **Join** (meeting link) and **Recording** buttons, owner/admin
  "Mark done", edit, and admin delete. `ClassModal` for create/edit (provider + link fields).
  Hooks in `lib/classes.js`. Route `/app/schedule`.
- Verified end-to-end against in-memory MongoDB: **16/16** checks (RBAC, trainer batch-scoping,
  forced-self trainer, time-validation 400, role-scoped listing, batch + date-range filters,
  non-owner edit 403, lifecycle + recording, admin-only delete).

## ✅ Milestone 4 — Attendance (done)

- **API** (`/api/attendance`): per-class **roster** (batch students merged with existing marks)
  and **bulk save** (upsert, one record per class+student, sets `ClassSchedule.attendanceMarked`)
  — admin or owning trainer only; `GET /me` (student self summary+history); `GET /student/:id`
  and `GET /batch/:id` compliance (admin/trainer). Percentage rule: `attended = present + late`,
  **excused excluded** from the denominator; below-minimum flag uses `Settings.minAttendance`.
- **UI** (`/app/attendance`, role-branched):
  - Student → summary stats (%, attended, late, absent) + history table.
  - Trainer/Admin → **Mark Attendance** tab (pick a class → `RosterEditor` with per-student
    status selects, remarks, "All present/…" quick-set, Save) and **Compliance** tab
    (batch picker → per-student %/breakdown table with low-attendance ⚠ badges).
  - Student dashboard now shows real attendance % + upcoming classes.
- Verified end-to-end against in-memory MongoDB: **15/15** checks (roster, RBAC 403s for
  non-owner/student, upsert idempotency, non-enrolled 400, late-as-attended, excused-excluded,
  below-minimum flagging, default 75% threshold).

## ✅ Milestone 5 — Assessments + trainer-controlled unlock flow (done)

- **API** (`/api/assessments`): role-aware list/get (students only see **unlocked** assessments
  for their batch's modules, with `correctOption` stripped + their submission summary); author
  (admin or **assigned trainer**) — create (one per practiceIndex, single final per module,
  always starts **locked**), update meta, delete (blocked once submissions exist), **lock/unlock**
  (the gate; sets `unlockedBy`, optional availability window), and MCQ question add/update/delete.
- **Submissions**: student `submit` with **MCQ auto-grading** (score over MCQ points, `passed`
  vs `passingScore`), enforcing unlocked + availability window + **single attempt**;
  `GET /:id/submission` (self) and `GET /:id/submissions` (admin/assigned trainer).
- **UI** (`/app/assessments`, role-branched): student list (locked items hidden, take/result
  cards) → `TakeAssessment` (MCQ radios / free-text, submit → score + pass/fail result);
  trainer/admin module-scoped list with create, `AssessmentEditor` (MCQ question authoring with
  correct-answer picker, unlock/lock, submissions table). Hooks in `lib/assessments.js`.
- Verified end-to-end against in-memory MongoDB: **22/22** checks (assigned-trainer-only
  authoring incl. 403, dup practiceIndex/final 409, invalid-MCQ 400, locked invisible to
  students, submit-while-locked 403, unlock → visible + answer-key hidden, 100%/50% auto-grade
  pass/fail, single-attempt 409, delete-with-submissions 409, deadline enforcement, out-of-curriculum 403).

## ✅ Milestone 6 — AI evaluation engine (done)

- **`LMS_AI_Engine`** (Claude API via `@anthropic-ai/sdk`, model `claude-opus-4-8`, adaptive
  thinking, **structured outputs** through `output_config.format` JSON schema):
  - `evaluatePrompt` → clarity / completeness / reasoning / structure / output-quality (each
    0–100) + overall /100, summary, suggestions.
  - `evaluateProject` → fetches a public GitHub repo's source (`src/github.js`, size-bounded,
    skips vendor dirs) and reviews functionality / architecture / code-quality / documentation.
- **Backend** (`services/aiGrading.js`): `gradeSubmission` combines MCQ (deterministic) with
  AI-graded prompt/scenario/coding answers, **points-weighted** into an overall score + pass/fail
  + aggregated feedback (summary, per-question breakdown, suggestions). `submit` now: all-MCQ →
  graded synchronously; has non-MCQ + key configured → status **`evaluating`** + fire-and-forget
  background grade; no key → **`submitted`** (manual review). Admin/assigned-trainer **regrade**
  endpoint. Needs `ANTHROPIC_API_KEY` (optional `GITHUB_TOKEN`); degrades gracefully without it.
- **UI**: `TakeAssessment` polls while `evaluating` and renders the AI feedback (score, criterion
  badges, suggestions); coding questions show a GitHub-URL field; trainer submissions table shows
  Evaluating / Pending review / Passed-Failed.
- Verified: engine loads + GitHub URL parser; **8/8** grading-combine integration checks against
  in-memory MongoDB with a fake evaluator (weighting, aggregation, unanswered=0, all-MCQ w/o key,
  throw-without-evaluator). Live Claude calls require a key (not run here).

## ✅ Milestone 7 — Progression engine (done)

- **`services/progression.js`** `computeProgress(studentId)`: walks the student's **batch's
  ordered modules** and computes, per module, attendance % (vs `Settings.minAttendance`),
  final-assessment score/passed, and passed-practice count. A module is **complete** when
  `finalPassed && attendanceMet`; the next module **unlocks only when the previous is complete**
  (Beginner → Expert). Returns `eligibleForCertificate` when all modules are complete, and
  **upserts `ModuleProgress`** snapshots for analytics.
- **API** (`/api/progress`): `GET /me` (student) and `GET /student/:id` (admin/trainer).
- **UI**: student **`CurriculumPage`** (`/app/curriculum`) — ordered modules with
  Completed/In-progress/🔒Locked badges, per-module attendance %, final score, practice count,
  Continue/Review CTA, overall path %, and a program-complete certificate banner. Student
  dashboard now shows real "Modules Completed X/N" + current module. Hook in `lib/progress.js`.
- Verified end-to-end against in-memory MongoDB: **20/20** checks — sequential unlock, attendance
  gate (final passed but <75% → not complete), final-pass gate, no-final-blocks-completion,
  certificate eligibility, and `ModuleProgress` persistence.

## ✅ Milestone 8 — Certificates (done)

- **`services/certificates.js`** `issueEligibleCertificates(studentId)`: idempotent — issues one
  **per-module** certificate per completed module (gated on the progression engine) and a single
  **program** certificate once all modules are complete. Unique IDs (`AIRE-<CODE>-<YEAR>-<rand>`),
  and a **QR code** (`qrcode` pkg) encoding the public verify URL (`APP_BASE_URL/verify/<id>`).
  Triggered after final grading (sync + background) and lazily on the student's certificates page.
- **API** (`/api/certificates`): **PUBLIC** `GET /verify/:certificateId` (no auth — what the QR
  resolves to), `GET /me` (student, ensure+list), `GET /student/:id` (admin/trainer), `GET /` (admin all).
- **UI**: role-aware `CertificatesPage` (student → cert cards + printable `Certificate` artifact with
  name/module/date/ID/QR and Print→PDF; admin → all-issued table) and a **public `/verify/:id`** page
  (outside auth) showing Verified ✅ / Not-found ❌ with the award details. Hooks in `lib/certificates.js`.
- Verified end-to-end against in-memory MongoDB: **15/15** checks — idempotent issuance, program cert
  on full completion, unique-ID format, QR data URL, verify-URL base, and public verify (valid / program / invalid).

## ✅ Milestone 9 — Analytics dashboards (done)

- **`services/analytics.js`** (Mongo aggregations): `adminOverview` → platform counts
  (students/trainers/active-batches/modules/certificates), **low-attendance alerts** (per-student
  attendance via aggregation, flagged < `Settings.minAttendance`), batch sizes, and module-completion
  distribution (from `ModuleProgress`). `trainerOverview` → assigned counts + students + upcoming
  classes, per-batch average attendance, and per-assessment submissions / pass-rate / avg-score.
- **API** (`/api/analytics`): `GET /admin` (admin), `GET /trainer` (trainer/admin).
- **UI**: role-aware `AnalyticsPage` with a **theme-driven `BarChart`** primitive
  (`components/charts`, colors from `chartSeriesColors(theme)`) — module completion, batch sizes,
  per-batch attendance, low-attendance table, assessment-performance table. Admin & Trainer
  **dashboards are now live** (real counts + low-attendance alerts) off the same hooks. Hook in
  `lib/analytics.js`.
- Verified end-to-end against in-memory MongoDB: **13/13** checks — counts, low-attendance flagging
  (only the <75% student), batch-avg attendance (62.5→63%), pass-rate (50%), and avg-score (65%).

## ✅ Milestone 10 — Settings (done)

- **API** (`/api/settings`): **PUBLIC** `GET /public` (`activeTheme`, `allowSelfRegistration` — for
  the login/registration screens before auth), admin `GET /` (full settings), admin `PATCH /`
  (validated: `passingScore`/`minAttendance` 0–100, `allowSelfRegistration`, `activeTheme`). Backed
  by the singleton `Settings` doc already consumed across grading, progression, attendance, certs.
- **UI**: admin **`SettingsPage`** (`/app/settings`) — edit passing score, min attendance, default
  theme (applied immediately), and the self-registration toggle. Completes **configurable
  self-registration**: the login page shows a "Create an account" link only when enabled, and a
  minimal **`RegisterPage`** (`/register`, public) posts to `/auth/register` → pending-approval.
- Verified end-to-end against in-memory MongoDB: **10/10** checks — public exposure, admin
  read/update, **RBAC 403s** for non-admins, range **validation 400**, and the full
  self-registration gate (disabled → 403; after enabling → 201 pending → login blocked until approved).

## 🎉 Build complete

All ten milestones are implemented, each verified end-to-end against an in-memory MongoDB. The
full spec'd journey works: **onboard → batch → daily classes → manual attendance → trainer
completes syllabus → unlocks practice tests → assessments (MCQ auto-grade + AI prompt/project
grading) → final ≥ pass mark + attendance ≥ min → next module unlocks → program completion →
auto-issued, QR-verifiable certificates**, with role dashboards, analytics, and admin-configurable
rules — all on the two-theme design system.

### ✅ Post-build addition — Admin user-management UI (done)

- **`UsersPage`** (`/app/users`, admin): filterable/paginated directory (role/status/search), create
  user (any role), approve pending self-registrations, edit (name/phone/status), and archive. Hooks
  added to `lib/users.js`. Replaces the last `Placeholder` — every nav route is now a real screen.
- Verified end-to-end against in-memory MongoDB: **13/13** checks — paginated envelope, **no
  passwordHash leak**, role/status/search filters, pagination metadata, create + duplicate-email 409,
  approve (+ non-pending 400), update, soft-archive, and trainer-blocked **403** RBAC.

### ✅ Post-build addition — Resource uploads (done)

- **Storage**: `config/storage.js` resolves `LMS_Storage/uploads` (ensured on boot); files are
  served statically at **`/api/uploads/...`** (mounted before the rate limiter, so downloads don't
  count against the API budget; bypasses auth like any static asset).
- **API** (`/api/resources`): `multer` disk upload (sanitized filenames, 100 MB cap). `POST` accepts
  **either** a multipart `file` **or** an external `url`; `GET ?module=` is role-scoped (admin/trainer
  any; student only for modules in their batch); `DELETE` — all writes restricted to admin or the
  module's assigned trainer.
- **UI**: `ResourcesPanel` in `ModuleDetailPage` — upload-file-or-link form (video / document /
  presentation / assignment / link) for editors; everyone with view rights sees the list with
  open/download links. Hooks in `lib/resources.js` (FormData upload).
- Verified end-to-end against in-memory MongoDB: **10/10** checks — link add, **real multipart file
  upload served back statically**, no-source 400, RBAC (unassigned-trainer/student 403), role-scoped
  + out-of-curriculum 403 listing, and delete.

### ✅ Post-build addition — Doubts / Q&A ("Ask doubts" / "Answer questions") (done)

- **Model** `Doubt`: `{ student, module?, batch, title, status (open/answered/closed), messages[] }`
  (threaded; first message is the question). New `DoubtStatus` enum in `@lms/shared`.
- **API** (`/api/doubts`): student `POST` (creates open thread); **role-scoped** `GET` (student → own;
  trainer → doubts whose module/batch they're assigned to; admin → all) with status/module filters;
  `GET /:id` (same scoping); `POST /:id/replies` — owning student, assigned trainer, or admin
  (a trainer/admin reply marks it **answered**; a student follow-up **reopens**); `PATCH /:id/status`
  (trainer/admin close/reopen).
- **UI**: role-aware `DoubtsPage` — students ask + track threads, trainers/admins answer from a queue;
  chat-style thread modal with status badges and close/reopen. Nav entry for all three roles; hooks
  in `lib/doubts.js`.
- Verified end-to-end against in-memory MongoDB: **15/15** checks — create, student-only-create 403,
  role-scoped list + thread (assigned-trainer yes / unassigned + other-student 403), reply→answered,
  unassigned-trainer reply 403, student-follow-up reopen, student-set-status 403, admin close, filters.

These two ("Ask doubts" / "Answer questions") were the last spec capabilities not yet wired. Every
requirement in the brief is now implemented.

### Remaining future work (enhancements, not in scope of the brief)

- **Live AI-eval run** — exercise the Claude path with a real `ANTHROPIC_API_KEY` (engine is wired
  and unit/contract-tested; only the network call is unverified).
- **Meeting integrations** — deeper Zoom/Meet/Teams hooks beyond stored links.

## Conventions

- API responses use the `ApiResponse<T>` envelope; lists use `Paginated<T>`.
- New feature = model (exists) → Zod-validated controller → route mounted in
  `routes/index.js` → API call on the frontend → page replacing its `Placeholder`.
- Never hardcode colors; consume design-system variables / `@lms/shared` tokens.
