# 15 — Deployment Strategy

> **Derives from:** `00_ArchitectureDecisions.md` §2 (toolchain), §9 (delivery &
> operations), §10 (ports/env). Expands the delivery baseline into the concrete
> build → ship → operate design. Security headers/CSP referenced here are specified
> in `13_SecurityArchitecture.md`; probes and alerts in `14_LoggingMonitoring.md`.
>
> **Principle:** one VM and docker-compose can serve this platform far past launch.
> Every step of the scaling roadmap (§10) is taken when a measurement demands it,
> not before. **Kubernetes is explicitly NOT Phase 1** (§10).

---

## 1. Environments

|                | local                                                       | staging                                    | production                                            |
| -------------- | ----------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------- |
| API            | `http://localhost:4000/api/v1` (docs at `/docs`)            | `https://api.staging.qalam.example/api/v1` | `https://api.qalam.example/api/v1` (`/docs` disabled) |
| Frontend       | `http://localhost:5173`                                     | `https://app.staging.qalam.example`        | `https://app.qalam.example`                           |
| Admin          | `http://localhost:5174`                                     | `https://admin.staging.qalam.example`      | `https://admin.qalam.example`                         |
| Media          | `http://localhost:9000/qalam-media` (MinIO; console `9001`) | `https://media.staging.qalam.example`      | `https://media.qalam.example` (CDN, §8)               |
| Postgres       | `localhost:5432`, db `qalam`, user `qalam`                  | managed/VM instance, private network only  | same, + PITR backups (§9)                             |
| Redis          | `localhost:6379` (DB 0–3 per ADR map)                       | private network only                       | same                                                  |
| Mail           | mailpit SMTP `1025`, UI `8025`                              | real SMTP, staging sender domain           | real SMTP                                             |
| Deploy trigger | `pnpm dev` / compose                                        | **auto on merge to `main`**                | **tag `v*` + manual approval**                        |
| Secrets source | `.env` (git-ignored)                                        | GitHub Environment `staging`               | GitHub Environment `production` (protected)           |

`*.qalam.example` domains are placeholders until the production domain is purchased —
every config derives them from `APP_URL` / `API_URL` / `VITE_API_URL` env vars, so the
rename is an environment change, not a code change.

**Data policy:** staging runs **synthetic seed data only**
(`backend/src/database/seeds/`, same fixtures the e2e suite uses, plus a bulk
generator for realistic volumes). **Production data never flows to staging or local**
— no "sanitized dumps": scrubbing user-generated prose reliably is harder than
generating fake prose, and one failed scrub is a breach (doc 13 §2). Restore drills
(§9) run against an isolated environment, not staging.

## 2. Docker Images

### 2.1 Backend — Multi-Stage Walkthrough

`infrastructure/docker/backend.Dockerfile`, four stages:

```dockerfile
# ── 1. base: pinned toolchain ─────────────────────────────────────────────
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /repo

# ── 2. fetch: dependency layer, maximally cacheable ──────────────────────
FROM base AS fetch
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch                              # lockfile-only → this layer survives all source edits

# ── 3. build: compile workspace subtree ──────────────────────────────────
FROM fetch AS build
COPY . .
RUN pnpm install --frozen-lockfile --offline \
 && pnpm turbo build --filter=backend...    # builds @qalam/shared, utils, api-types first (^build)
RUN pnpm --filter=backend deploy --prod /out   # prunes to prod deps, self-contained node_modules

# ── 4. runtime: minimal, non-root ─────────────────────────────────────────
FROM node:24-alpine AS runtime
RUN addgroup -S qalam && adduser -S qalam -G qalam
WORKDIR /app
COPY --from=build --chown=qalam:qalam /out .
USER qalam
EXPOSE 4000
CMD ["node", "dist/main.js"]                # exec form: node is PID 1, receives SIGTERM (§6)
```

Why each choice: **`pnpm fetch` before source copy** — dependency download is keyed on
the lockfile alone, so day-to-day builds skip it entirely. **`--offline` install** —
proves the lockfile is complete (supply-chain tripwire, doc 13 §12).
**`pnpm deploy --prod`** — the runtime image carries zero devDependencies and no
workspace symlink surprises. **alpine over distroless** (choosing within the ADR's
"distroless/alpine" latitude): `sharp`/`argon2` ship musl prebuilds, and a shell in
the container is worth its 5 MB during incidents. **Non-root `qalam` user** — container
escape ≠ root. Workers run from the **same image** with a different command
(`node dist/worker.js`) once extracted (§10) — one build, two roles.

### 2.2 Frontend & Admin — Static Bundle Behind nginx

`infrastructure/docker/frontend.Dockerfile` (admin identical, different filter):

```dockerfile
FROM node:24-alpine AS build
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY . .
ARG VITE_API_URL VITE_SENTRY_DSN VITE_APP_ENV      # Vite inlines at BUILD time → image is per-environment
RUN pnpm install --frozen-lockfile --offline && pnpm turbo build --filter=frontend...

FROM nginx:1.27-alpine AS runtime
COPY infrastructure/nginx/spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/frontend/dist /usr/share/nginx/html
# nginx:alpine runs workers as non-root user "nginx"; port 8080 (unprivileged)
EXPOSE 8080
```

Because `VITE_*` vars are inlined at build time, frontend images are built **per
environment** in the deploy job (staging build ≠ production build) — accepted cost;
the alternative (runtime env injection into static bundles) adds a config-fetch
indirection we don't need at two environments.

### 2.3 Image Tagging Scheme

Registry: GHCR (`ghcr.io/<org>/qalam-{backend,frontend,admin}`).

| Tag                     | Applied when       | Meaning                                                 |
| ----------------------- | ------------------ | ------------------------------------------------------- |
| `sha-<12-char git sha>` | every image build  | **Immutable identity** — the only tag deploys reference |
| `v1.4.2`                | on git tag `v*`    | Human-readable release pointer to a sha tag             |
| `staging`               | on merge to `main` | Moving pointer, convenience only                        |
| `latest`                | never              | Banned — "latest" deploys are unauditable               |

The git sha also feeds Sentry release names (`qalam-<app>@<sha>`, doc 14 §2.2) —
one identifier across image, deploy log, and error tracker.

### 2.4 `.dockerignore` Policy

Explicit allowlist mindset: `node_modules`, `**/dist`, `.git`, `.env*` (except
`.env.example`), `docs/`, `coverage/`, `.turbo/`, `*.md`. Two goals: build-context
speed, and **making it structurally impossible to bake a local `.env` or git history
into an image** (doc 13 §10).

## 3. docker-compose — Local Development

Per ADR §9: **default profile = infra only**; apps run on the host for hot reload.

```yaml
# docker-compose.yml (shape, not full file)
services:
  postgres: # postgres:16-alpine, port 5432, db/user qalam, volume pgdata
  redis: # redis:7-alpine, port 6379, appendonly yes
  minio: # ports 9000/9001, bucket qalam-media created by init job
  mailpit: # SMTP 1025, UI 8025
  backend:
    { profiles: ['full'], build: infrastructure/docker/backend.Dockerfile, ports: ['4000:4000'] }
  frontend: { profiles: ['full'], ports: ['5173:8080'] }
  admin: { profiles: ['full'], ports: ['5174:8080'] }
```

| Workflow                                             | Command                                                                                            |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Daily development                                    | `docker compose up -d` (infra only) → `pnpm dev` (turbo runs backend + both Vite servers with HMR) |
| Full containerized stack (pre-release smoke, CI e2e) | `docker compose --profile full up --build`                                                         |
| Reset local data                                     | `docker compose down -v` → `pnpm db:migrate && pnpm db:seed`                                       |

**Why infra-only default:** containerized Node dev servers cost HMR latency and
file-watch pain for zero fidelity gain — the parts worth containerizing locally are
the stateful services, which exactly match production versions (postgres 16, redis 7).

## 4. CI/CD — GitHub Actions

Workflows in `.github/workflows/` (ADR §2 — must live at repo root).

### 4.1 Pipeline Shape

```
                         ┌──────────────────────── ci.yml (PR + main) ────────────────────────┐
 PR opened ──► title check (conventional commits)                                             │
           ──► pnpm install --frozen-lockfile  (pnpm store + turbo cache restored)            │
           ──► turbo lint ── turbo typecheck ── turbo test ── turbo build   (affected-aware)  │
           ──► pnpm audit --prod --audit-level high   ── gitleaks scan                        │
           └──► all green = mergeable ────────────────────────────────────────────────────────┘

 merge to main ──► ci.yml (again, on merged tree)
               ──► deploy-staging.yml:
                     build 3 images (sha tag) ─► push GHCR ─► upload sourcemaps to Sentry
                     ─► ssh staging: run migrations ─► roll containers (§6) ─► smoke: /health/ready
                     └─► auto — no human gate

 git tag v* ──► deploy-production.yml:
                  resolve tag → sha (image already built & staged-proven; build only if missing)
                  ─► ⏸ MANUAL APPROVAL (GitHub Environment "production" protection rule)
                  ─► ssh production: backup checkpoint (§9) ─► run migrations (§5)
                  ─► roll containers one-by-one behind nginx (§6) ─► smoke ─► tag Sentry release
```

### 4.2 Decisions

- **Turbo remote cache** across CI runs — lint/test/build skip unaffected packages;
  a docs-only PR is green in seconds. (Cache is content-hashed; a cache hit is a
  proof the inputs didn't change, not an assumption.)
- **Conventional-commit PR title check** (`amannn/action-semantic-pull-request`,
  SHA-pinned like all third-party actions — doc 13 §9/A08): squash-merge titles
  become the changelog.
- **Staging deploys the exact sha it built; production promotes that same sha.**
  Build-once-promote-many: production never runs bytes that staging hasn't.
- Deploy mechanism is deliberately dumb Phase 1: SSH + `docker compose pull && up`
  on the target VM, driven by the workflow. No deploy agents, no GitOps controller —
  the fleet is one or two hosts (§10).
- Required checks branch protection on `main`; force-push disabled; environments
  hold the secrets (doc 13 §10) — the repo itself contains none.

## 5. Database Migrations — Deploy Step, Never Boot

Per ADR §9: migrations run as an **explicit deploy step before app rollout** —
never at application boot.

**Why never at boot:** boot-time migrations turn a horizontal scale-out or a crash
restart into a schema-change attempt; two instances racing migrations is undefined
behavior; and a failed migration must fail the _deploy_ (visible, attended) — not
mark a pod unhealthy at 03:00 (unattended).

```
deploy = ① backup checkpoint → ② typeorm migration:run (new image, one-off container)
         → ③ roll app containers → ④ smoke
```

**Backward-compatible migration rule (expand → migrate → contract):** step ③ means
old code briefly runs against the new schema, therefore **every migration must be
compatible with the previous app version**. Renaming `pieces.summary` → `subtitle`:

| Phase    | Release   | Change                                                                   |
| -------- | --------- | ------------------------------------------------------------------------ |
| Expand   | N         | Add `subtitle` (nullable); code writes both, reads `subtitle ?? summary` |
| Migrate  | N (async) | Backfill job copies remaining rows in batches                            |
| Contract | N+1       | Code reads/writes `subtitle` only; migration drops `summary`             |

Banned in a single release: column drops/renames in use, type narrowing,
adding `NOT NULL` without default + backfill. `/migration-check` (global command)
reviews every generated migration against this rule before merge; merged migrations
are immutable (ADR §4) — fixes are new migrations.

**Rollback playbook** — the two rollbacks are different tools; know which one you need:

| Failure                                        | Action                                                                                                                                                                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App bug, schema fine (the common case)         | **App rollback only:** redeploy previous sha tag (one compose command). Safe _because_ of the expand/contract rule — old code runs on new schema by construction                                                                        |
| Migration failed mid-deploy (step ②)           | Deploy halts before rollout; previous app version still serving. TypeORM migrations run in transactions where DDL allows — fix forward with a new migration; `migration:revert` only for the just-failed, not-yet-depended-on migration |
| Migration succeeded but is wrong (data damage) | **Never `migration:revert` in production after traffic has written.** Write a corrective forward migration; if data is destroyed, PITR restore (§9) to a side instance and repair from it                                               |

## 6. Zero-Downtime Deploys

- **Health-gated rollout:** new container starts → deploy script polls
  `/health/ready` (doc 14 §3) until green (timeout 60 s → abort, old container never
  stopped) → nginx upstream switches → old container gets SIGTERM. With two API
  containers this is a rolling replace; with one, the overlap pattern still holds
  (start-new, switch, stop-old) since the API is stateless.
- **Graceful shutdown** (`app.enableShutdownHooks()`):

```
SIGTERM ─► 1. /health/ready flips to 503 (nginx stops routing new work)
        ─► 2. HTTP server stops accepting; in-flight requests drain (≤ 30 s)
        ─► 3. BullMQ workers: worker.close() — finish active jobs, take no new ones
               (jobs are retry-safe + idempotent by design, doc 14 §5 — a hard kill
                at the 45 s deadline loses no work, it re-queues it)
        ─► 4. close pg pool, redis clients ─► exit 0        (docker stop timeout: 45 s)
```

- **Session-stateless API** is what makes all of this trivial: no sticky sessions,
  no in-process session store — auth state is JWT + Redis (doc 13 §3), cache is
  Redis, queues are Redis. Any instance can serve any request; instances are cattle.

## 7. nginx — Reverse Proxy Layout

One nginx at the edge (`infrastructure/nginx/`), TLS-terminating, three server
blocks + media:

```
                                 ┌────────────────────── nginx (443, TLS, HTTP/2) ─────────────────────┐
 app.qalam.example    ──► SPA: try_files $uri /index.html; static from frontend container              │
 admin.qalam.example  ──► SPA fallback; static from admin container  (+ optional IP allowlist)         │
 api.qalam.example    ──► proxy_pass http://api_upstream;  WebSocket upgrade headers ready             │
 media.qalam.example  ──► CDN origin → bucket (§8) — nginx only involved for MinIO in dev              │
```

Key config decisions (values in the conf templates):

| Concern          | Setting                                                                                                                           | Why                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Compression      | gzip on for text/*, application/json/js/svg, level 5, min 1 kB; **brotli static** (`.br` emitted at Vite build)                   | Brotli-precompressed bundles: best ratio, zero runtime CPU                             |
| Static caching   | hashed assets `Cache-Control: public, max-age=31536000, immutable`; `index.html` `no-cache`                                       | Vite content-hashes filenames — deploys are instantly visible, assets never re-fetched |
| SPA fallback     | `try_files $uri $uri/ /index.html`                                                                                                | React Router owns the URL space                                                        |
| Upload size      | `client_max_body_size 12m` on API vhost only (covers 10 MB cover cap + form overhead, doc 13 §7); `1m` elsewhere                  | Big-body DoS surface limited to the one route class that needs it                      |
| Timeouts         | `proxy_read_timeout 30s`; API is fast-or-failed (long work is queued, ADR §3)                                                     | Nothing user-facing legitimately runs > 30 s                                           |
| Security headers | HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`, CSP per doc 13 §5.4 — set at nginx for SPAs, helmet for API | One authoritative place per surface                                                    |
| Request id       | `proxy_set_header X-Request-Id $request_id` (generate if absent) + `X-Forwarded-For/-Proto`                                       | Correlation chain starts here (doc 14 §1.5)                                            |
| Rate limiting    | none at nginx beyond a coarse `limit_req` safety net (50 r/s/IP burst 100)                                                        | Real tiers live in Redis app-side (doc 13 §8) where user identity exists               |

## 8. Media & CDN

Per ADR §3: MinIO in dev, S3-compatible (S3 or R2) in prod, bucket `qalam-media`,
API never proxies bytes. Production layout:

```
 upload:  client ── pre-signed PUT ──► bucket (quarantine/)     [doc 13 §7 pipeline]
 serve:   client ──► CDN (media.qalam.example) ──► bucket (public/ prefix, read-only policy)
```

- **CDN in front of the bucket** (CloudFront/Cloudflare — R2+Cloudflare is the cost
  favorite: zero egress): global latency for a global audience, and the bucket
  origin is not directly reachable.
- **Cache headers:** processed media keys are content-addressed
  (`public/{uuid}-{variant}.webp`, immutable by construction) →
  `Cache-Control: public, max-age=31536000, immutable` set at upload time. "Changed
  avatar" = new key + DB pointer update — **no CDN invalidation path needed**, ever.
- Response headers on media (doc 13 §7): `X-Content-Type-Options: nosniff`,
  `Content-Security-Policy: sandbox`, correct `Content-Type` from processing step.
- `quarantine/` prefix: no public read policy, lifecycle rule deletes objects > 24 h.

## 9. Backups & Disaster Recovery

| What                                  | Method                                                                                                                                                                                  | Schedule                       | Retention                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------- |
| Postgres                              | **Daily base backup + continuous WAL archiving** (pgBackRest or wal-g → object storage, separate bucket + credentials from app S3 keys)                                                 | base 02:00 UTC; WAL continuous | 30 days of PITR window; weekly bases kept 90 days |
| Object storage (`qalam-media/public`) | Bucket replication to second region/provider                                                                                                                                            | continuous                     | mirror                                            |
| Redis                                 | **Not backed up.** DB 0 cache (rebuildable), DB 2 rate-limit (ephemeral), DB 1 queues + DB 3 auth accept loss: in-flight jobs re-enqueue from domain state; auth loss = forced re-login | —                              | —                                                 |
| Config/secrets                        | GitHub Environments + sealed copy in team password manager                                                                                                                              | on change                      | —                                                 |

- **PITR** (point-in-time recovery) is the reason for WAL archiving: "restore to
  13:47, right before the bad migration" — see §5 rollback playbook.
- **Restore drill: monthly**, scripted: provision scratch instance → restore latest
  base + WAL to a target timestamp → run row-count + checksum sanity queries →
  record duration. _An untested backup is a hope, not a backup._ Drill overdue →
  digest alert (doc 14 §8).
- **Targets: RPO ≤ 5 minutes** (WAL ship interval), **RTO ≤ 4 hours** (measured by
  the drill, includes DNS/infra time). Media RPO ~0 (replication); Redis RPO
  explicitly ∞ by design (see table).
- Backup bucket uses **separate credentials** the app never holds — ransomware on the
  app host cannot destroy the backups (doc 13 §2, media storage row).

## 10. Scaling Roadmap

Take each step only when the stated trigger is _measured_ (doc 14 metrics), never
speculatively.

| Stage                                     | Topology                                                                                                                                                                                            | Trigger to move on                                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **1. Launch**                             | One VM: docker compose runs nginx, API (workers in-process), postgres, redis. CDN already external                                                                                                  | DB competing with app for RAM/IO; backup/restore ops on a shared box get scary                      |
| **2. Separate the database**              | Managed Postgres (or dedicated DB VM). App VM keeps nginx/API/redis                                                                                                                                 | API CPU saturated or event-loop lag alerts (doc 14 §4.3) while DB is fine                           |
| **3. API horizontal + worker extraction** | 2–3 API containers behind nginx (§6 already assumes this); BullMQ workers become a separate deployable — **same image, `node dist/worker.js`** (§2.1); this is the ADR's designated extraction seam | Deploy cadence/isolation needs outgrow compose-over-SSH; multi-host orchestration pain becomes real |
| **4. Orchestration (k8s or equivalent)**  | Only when there is a _fleet_ to orchestrate                                                                                                                                                         | —                                                                                                   |

**Kubernetes is NOT Phase 1 — explicitly.** Everything above is designed so k8s is a
_packaging change_, not an architecture change, whenever it earns its keep: images
are non-root with liveness/readiness probes (doc 14 §3), the API is stateless (§6),
shutdown is SIGTERM-graceful (§6), config is env-only (ADR §10), logs go to stdout
(doc 14 §1.7). Until then, a small team runs compose on VMs it can fit in its head —
operational simplicity **is** a security and reliability feature.

---

_Cross-references: CSP/security headers & rate limits → `13_SecurityArchitecture.md`
§5, §8 · probes, alert thresholds, Sentry releases → `14_LoggingMonitoring.md` ·
queue semantics & idempotency → ADR §3, doc 14 §5._
