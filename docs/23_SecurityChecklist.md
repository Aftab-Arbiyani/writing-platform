# 23 — Security Checklist

Production security posture and the pre-release security gate. Design rationale
lives in `13_SecurityArchitecture.md`; this is the operational checklist + the
state as of Epic 12 hardening.

## Current posture (✅ = in place)

### Authentication & session

- [x] Argon2id password hashing (64 MiB / t=3 / p=4), above OWASP minimums.
- [x] Password policy: length 10–128, common-password rejection (NIST 800-63B).
- [x] JWT access (15 min) + rotating refresh (30 d) with **family reuse detection**
      (Redis DB3); "log out everywhere" via session-version bump.
- [x] Google OAuth (code + PKCE); the exchange body is now DTO-validated.
- [x] Global default-deny (`JwtAuthGuard` APP_GUARD); `@Public()` opts out.

### Authorization

- [x] PBAC (`@Permissions` + `PermissionGuard`); admin/system routes gated on
      `admin.dashboard` (read) / `system.manage` (mutations).

### Transport & headers

- [x] `helmet()` security headers; CORS locked to an explicit origin allowlist,
      `credentials: true`.
- [x] Refresh token in an httpOnly, Secure (prod), SameSite=Lax cookie scoped to
      `/api/v1/auth` → minimal CSRF surface (bearer access token is not
      cookie-borne). Edge adds HSTS/CSP (docs 15 §7).

### Input & injection

- [x] Global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted` + `transform`,
      implicit conversion off) — every endpoint has a validated DTO.
- [x] TypeORM parameterization only; **no SQL string interpolation** anywhere.
- [x] XSS: TipTap content sanitized server-side against a schema whitelist
      (docs 13 §5.2); responses are JSON; SPA edge sets nosniff/frame headers.

### Rate limiting (Epic 12)

- [x] **Global** `RateLimitGuard` (APP_GUARD, after auth): every endpoint is
      limited — declared `@RateLimit` tier or the `apiDefault` 300/min baseline.
      No route ships unlimited. Auth tiers strict (login 5/min). `RATE_LIMIT_ENABLED`
      is the load-test valve. Health/metrics probes exempt.

### Secrets & data handling

- [x] Secrets via env only (Zod-validated at boot); none committed; gitleaks in CI.
- [x] **Log redaction** single source (`logger/redaction.ts`) — tokens/passwords/
      cookies `[REDACTED]` in Pino + mirrored in Sentry `beforeSend`; emails never
      logged; tokens never in URLs.
- [x] Sentry `sendDefaultPii:false`, `Sentry.setUser({id})` id-only, `/auth/*`
      bodies dropped from events.
- [x] Every admin mutation path is permission-gated; `audit_logs` immutable, 7-yr.

### Dependencies (Epic 12)

- [x] `pnpm audit --prod --audit-level high` is a CI gate (no HIGH/CRITICAL).
- [x] nodemailer bumped 6→9 (cleared 2 HIGH: addressparser DoS, raw-option
      file-read/SSRF); multer forced ≥2.2.0 via override (cleared DoS HIGH).
- [x] Dependabot: weekly npm + github-actions + docker updates.

## Pre-release security gate

- [ ] CI `security-audit` job green (audit + gitleaks).
- [ ] No new `@Public()` endpoint without deliberate review (it joins the
      unauthenticated attack surface).
- [ ] New endpoints have a validated DTO and an appropriate `@RateLimit` tier (or
      accept the `apiDefault` baseline consciously).
- [ ] No secret/token/email added to any log line (grep the diff).
- [ ] `NODE_ENV=production` in the target env (Swagger `/docs` disabled).
- [ ] `METRICS_TOKEN` set and `/metrics` IP-allowlisted at the edge.

## Known / accepted items (tracked)

- **2 moderate** dev/transitive advisories remain (`pnpm audit`) — below the HIGH
  gate; reviewed, no production-exploitable path. Re-audit each release; upgrade
  when upstream patches land (Dependabot surfaces them).
- **GitHub Actions are pinned to version tags, not commit SHAs.** Docs 13/15 §4
  prescribe SHA-pinning; do this before GA (each `uses:` → its commit SHA). Low
  risk today (first-party + well-known actions), tracked.
- **`/metrics` app-auth is a bearer token**; the primary control is the edge
  IP-allowlist (docs 14 §4) — ensure it is configured in the nginx prod vhost.
- **e2e is not yet a blocking CI gate** (runs via `e2e.yml` on demand / merge to
  main); becomes blocking with Testcontainers (Phase 1.5, docs 18).

## Public (unauthenticated) attack surface — review on change

Feed/discover reads, `GET /pieces/:id` (+comments/replies/responses/engagement),
public profiles + follower lists, search, `POST /pieces/:id/shares` (public
write), analytics view/read tracking, and the auth entry points (register/login/
refresh/verify/forgot/reset/google). **All now rate-limited** (Epic 12) and
DTO-validated. Any addition here is a security-review item.
