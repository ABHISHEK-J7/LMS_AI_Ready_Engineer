# Deployment — AI Ready Engineer LMS

Two containers: a Node **backend** (Express API + GridFS file serving) and an
**nginx web** container that serves both built SPAs and reverse-proxies `/api`
(including `/api/uploads`) to the backend.

## Quick start (Docker Compose)

```bash
# 1. Fill in the backend env (Atlas URI, JWT secrets, optional SMTP/AI/Zoom/LiveKit):
cp LMS_Backend/.env.example LMS_Backend/.env && edit it

# 2. Build + run (from repo root):
docker compose up -d --build
```

- Student/Trainer app → `http://<host>/`  (port 80)
- Admin app → `http://<host>:8080/`
- API/files → proxied to the backend at `/api/*`

Put a TLS terminator (e.g. nginx/Caddy/cloud LB) in front for HTTPS in production,
and point the two apps at separate hostnames if you prefer.

## Notes / constraints

- **Single backend instance.** The rate limiter and exam-maintenance sweeper are
  in-process; do **not** scale the `backend` service to multiple replicas until a
  shared store (Redis) is added. The `web` service can scale freely.
- **Timezone.** Set `TZ` (compose passes it to the backend) to your operating
  region so class/exam-window times are correct.
- **Required env** (server refuses to boot without them in production):
  `MONGO_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`. Seeding in production
  also requires an explicit `SEED_ADMIN_PASSWORD`.
- **Uploads** are stored in MongoDB/GridFS and served through the backend with a
  file-scoped access token; nginx is configured with `client_max_body_size 110m`
  and streaming (`proxy_request_buffering off`) to allow large resource uploads.
- **Health:** `GET /api/health` returns 200 when healthy and **503** when the DB
  is down — used by the backend container's `HEALTHCHECK`.
- **MongoDB:** assumes Atlas via `MONGO_URI`. To run Mongo locally, uncomment the
  `mongo` service in `docker-compose.yml` and point `MONGO_URI` at it.

## Build images individually

```bash
docker build -f LMS_Deployment/Dockerfile.backend -t lms-backend .
docker build -f LMS_Deployment/Dockerfile.web     -t lms-web .
```
