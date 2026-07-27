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

## Browser E2E — the frontend/admin release gate

The browser suite (`web-e2e.yml`, Playwright) is the **release-gate reference for the two web
apps**: it drives the real frontend (`:5173`) and admin (`:5174`) against a real backend, so it
is the only check that proves the shipped bundles, the API contract, and the read paths still
agree. Governing docs: [`docs/e2e/`](./e2e/README.md) — coverage matrix in
[06 §2](./e2e/06_PhasePlan.md), UI-quality policy in [10](./e2e/10_UIQuality.md), gate policy in
[07 §6](./e2e/07_CI.md).

- [ ] `web-e2e` job green — **functional (P1–P4) + `@a11y` + `@responsive`** on
      **chromium, firefox, and webkit** (sharded ×2). Covers auth, publish, feed, edit, search,
      profile, follow, notifications, settings, silent refresh, analytics, discover, resilience;
      admin users/roles/suspend, moderation (+ cross-app takedown), audit log, RBAC, and all four
      dashboards.
- [ ] `web-e2e-visual` job green — the **36 committed screenshot baselines** (27 light + 9 dark) verified inside the
      pinned `mcr.microsoft.com/playwright:v1.61.1-noble` image. A diff here is a **blocking**
      finding: either a real regression, or an intended change whose baselines must be
      regenerated via the workflow's `update_visual_baselines` dispatch input and **reviewed in
      the PR** ([10 §8.3](./e2e/10_UIQuality.md)) — never blind-accepted, never regenerated on a
      dev machine.
- [ ] **Zero critical/serious axe violations.** The known-debt register
      (`e2e/fixtures/a11y.ts` → `KNOWN_A11Y_FINDINGS`) is **empty** and should stay that way —
      every original entry was burned down ([10 §8.1](./e2e/10_UIQuality.md)). Adding an entry
      downgrades a real user-facing defect and needs the same sign-off as any other deferral.
- [ ] **Zero horizontal scroll** at mobile + tablet on both apps — no bounded-overflow exemptions
      ([10 §8.2](./e2e/10_UIQuality.md)).
- [ ] **Dark mode green** — the `frontend-dark` / `admin-dark` projects pass their a11y scans and
      their 9 visual baselines ([10 §3.3](./e2e/10_UIQuality.md)). Any token change must be checked
      in _both_ themes; computed ratios against the documented tokens are not sufficient evidence
      ([10 §8.4](./e2e/10_UIQuality.md)).
- [ ] No new quarantined, skipped, or `test.fixme`'d specs versus the previous release.
- [ ] If a **deferred coverage row** shipped this release (AI assistant `af2`, monetization `af5`,
      or the reader page `/p/:slug`), its E2E row is now implemented — not still ⏸ in
      [06 §2](./e2e/06_PhasePlan.md).

> The suite requires `RATE_LIMIT_ENABLED=false` on the E2E backend (fresh login per test would
> otherwise exhaust the `authLogin` 20/hour bucket) — that flag is E2E-only and must never reach a
> deployed tier; the rate limiter's own behaviour is covered by backend tests.

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
