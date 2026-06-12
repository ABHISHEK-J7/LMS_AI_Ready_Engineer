# LMS_Deployment

Container build + run configuration for the AI Ready Engineer platform.

| File | Purpose |
| --- | --- |
| `Dockerfile.backend` | Node 20 API image — non-root, prod deps only, healthchecked |
| `Dockerfile.frontend` | Vite build → nginx static image |
| `nginx.conf` | Serves the SPA, proxies `/api` (incl. uploads) to the backend, sets security headers |
| `docker-compose.yml` | mongo + backend + frontend, one command |
| `.env.deploy.example` | Template for the compose `.env` (secrets) |

## Quick start

```bash
cd LMS_Deployment
cp .env.deploy.example .env          # then fill in JWT secrets (and optionally ANTHROPIC_API_KEY)
docker compose up -d --build         # build images and start the stack
# Seed the admin + curriculum (first run only):
docker compose exec backend node LMS_Backend/src/seed/seed.js
```

Open **http://localhost:8080** and sign in (default seeded admin `admin@aiready.local` / `ChangeMe123!` — change it immediately).

## Topology

```
browser ──▶ frontend (nginx :80) ──/api──▶ backend (:5050) ──▶ mongo (:27017)
                  static SPA            internal network        internal volume
```

Only the frontend port is published (`PUBLIC_PORT`, default 8080). The backend and
mongo are reachable only on the internal compose network — nothing else is exposed.

## Using MongoDB Atlas instead of the bundled mongo

Remove the `mongo` service (and its `depends_on` + the `mongo-data` volume) from
`docker-compose.yml`, then set `MONGO_URI` to your Atlas SRV string in `.env`.

## Production notes

- Put a TLS-terminating reverse proxy (or a managed LB) in front of `frontend`; set
  `PUBLIC_ORIGIN` to your `https://` origin so CORS and certificate links are correct.
- Backend runs as the non-root `node` user; mongo + uploads persist on named volumes.
- Secrets come only from the compose `.env` (never baked into images — see root `.dockerignore`).
- See `../LMS_Documentation/SECURITY.md` for the full hardening checklist.
