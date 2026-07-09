# 22 — Release Checklist

Run before every production release. Ordered so a failure stops the release before
anything user-visible changes. See `19_DeploymentGuide.md` for commands and
`21_BackupRecovery.md` for rollback/PITR.

## Pre-release (in CI / on the PR)

- [ ] `verify` job green: **lint, typecheck, unit tests (272), build**.
- [ ] `security-audit` green: `pnpm audit --prod --audit-level high` (no HIGH/CRIT) + gitleaks (no committed secrets).
- [ ] `migrations` green: **up → down → up** validated against real Postgres.
- [ ] `docker-build` green: backend image builds.
- [ ] PR title is conventional-commit; CODEOWNERS review obtained.
- [ ] If the change is DB-touching: reviewed with `/migration-check`; it is
      **expand→migrate→contract** backward-compatible (old app works on new schema).

## Database migration validation

- [ ] New migrations have both `up()` and `down()` (CI enforces).
- [ ] No edits to already-merged migrations (immutable) — new migration instead.
- [ ] Long/locking DDL identified; run in a low-traffic window if needed.
- [ ] Backfills are batched + idempotent.

## Environment & secrets validation

- [ ] All required env present in the target GitHub Environment; Zod boot
      validation will fail fast otherwise.
- [ ] `NODE_ENV=production` (disables `/docs`), `SENTRY_DSN` set, `GIT_SHA` = deploy
      sha, `METRICS_TOKEN` set, `RATE_LIMIT_ENABLED=true`.
- [ ] No secret values changed silently that other services depend on (JWT secrets
      rotate = all sessions invalidated — intentional only).

## Deploy

- [ ] Pull the immutable `sha-<12>` image (never `latest`).
- [ ] **Run `migration:run` as an explicit step BEFORE app rollout.**
- [ ] Health-gated rollout: new container passes `/health/ready` before old is
      retired; `stop_grace_period: 45s` lets in-flight work drain.

## Post-deploy validation (smoke)

- [ ] `GET /health/ready` → 200 (Postgres + Redis + queues).
- [ ] `GET /health/storage` → 200 (or a known-acceptable degraded state).
- [ ] `GET /health/queues` → 200; `GET /admin/queues` shows workers > 0 and no
      runaway backlog.
- [ ] `GET /metrics` (with token) scrapes; error rate flat in Sentry for the new
      release tag.
- [ ] Cache: `GET /admin/cache` responds; trigger `POST /admin/cache/warm` if
      caches were flushed.
- [ ] Critical flows: login, read a piece, publish a piece, receive a notification.
- [ ] The every-minute `scheduled-publish` sweep logged a `job.completed`.

## Rollback procedure

1. **App-only regression** (schema unchanged): redeploy the previous immutable
   `sha-` image. Fastest path — prefer it.
2. **Bad schema change** (data intact): `migration:revert` (safe — tested `down()`).
   Roll the app back first if the change was expand→migrate→contract.
3. **Data corruption**: PITR to just before the bad deploy (`21_BackupRecovery.md`
   §3b). Never `revert` when data — not just schema — is wrong.
4. Announce in the incident channel; confirm `/health/ready` + Sentry error rate
   return to baseline; write the post-incident note.

## Monitoring validation (first 30 min)

- [ ] Sentry: no new issue on the release tag.
- [ ] `bullmq_oldest_waiting_age_seconds` flat (no stalling queue).
- [ ] `http_errors_total` / 5xx rate at baseline.
- [ ] p95 latency (`http_request_duration_seconds`) not regressed.
