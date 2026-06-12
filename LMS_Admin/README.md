# LMS_Admin — Administrator Portal

A **standalone admin application** for AI Ready Engineer, separate from the
student/trainer app (`LMS_Frontend`). Same backend, same design system, but
**admin-only**: non-admins are rejected at login.

- React + Vite, dev server on **:5174** (proxies `/api` → backend `:5050`).
- Reuses `@lms/shared` (themes, enums) so the palette stays on-brand.
- Screens: Dashboard, Users, Modules, Batches, Class Schedule, Attendance,
  Assessments, Announcements, Certificates, Analytics, Settings, per-student
  drill-down.

## Look & feel

A premium visual layer (`src/styles/admin-theme.css`) sits on top of the shared
design system — glass topbar, gradient sidebar with an animated active-nav
indicator, elevated cards, gradient stat tiles, refined buttons/tables. It is
fully theme-driven, so AI Ready **Green/Orange** and **light/dark** all work.

- **Icons:** [lucide-react](https://lucide.dev) everywhere (no emoji).
- **Motion:** [GSAP](https://gsap.com) — `src/lib/anim.jsx` provides
  `PageTransition` (route-change stagger), `useStaggerIn` (sidebar/list entrances),
  `CountUp` (animated dashboard metrics), and `useEntrance` (login card). All are
  `gsap.context()`-scoped (StrictMode-safe) and respect `prefers-reduced-motion`.

## Run

```bash
# from the repo root (backend must be running on :5050)
npm run dev:admin           # → http://localhost:5174
```

Sign in with an **administrator** account (e.g. the seeded `admin@aiready.local`).
Students and trainers use the main app (`LMS_Frontend`, :5173) — they cannot sign
in here, and admins cannot sign in to the main app.

## Build

```bash
npm run build:admin         # static assets in LMS_Admin/dist
```

Deploy the same way as `LMS_Frontend` (nginx serving `dist`, proxying `/api`).
