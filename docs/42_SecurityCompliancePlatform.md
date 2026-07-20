# 42 — Security & Compliance Platform (P7.2)

**Status:** ✅ Complete · **Scope:** strengthen security, privacy, compliance, governance, verification, auditing, and operational security. **No new business features.** Reuses every existing platform; nothing is redesigned. Builds directly on the security _design_ in **[docs 13 — Security Architecture](13_SecurityArchitecture.md)** (STRIDE threat model, OWASP Top-10 mapping, secrets rotation policy, audit design, incident-response basics) — P7.2 makes it centralized, verified, and complete.

> The **Security Platform** (`backend/src/modules/security`) is the central point for security-policy enforcement. The **Policy Engine** remains the SSOT for authorization; the **Entitlement Service** remains the SSOT for premium access; the **RateLimitGuard** remains the rate-limit floor. The Security Platform composes these — it never duplicates them.

---

## 1. Folder tree (new / changed)

```
platfrom/
├─ backend/src/
│  ├─ main.ts                              # ~ tuned API CSP, Permissions-Policy, request-size guard, CORS methods/headers pin
│  ├─ config/
│  │  ├─ env.schema.ts                     # ~ ENCRYPTION_KEYS/ACTIVE_KEY_ID, key-max-age, lockout/idempotency toggles
│  │  ├─ security.config.ts                # + security namespace (encryption keys, lockout, idempotency)
│  │  └─ config.module.ts                  # ~ load securityConfig
│  ├─ modules/security/                     # + THE SECURITY PLATFORM (@Global)
│  │  ├─ security.constants.ts             #   action taxonomy, threat levels, event types, redis ns, metrics
│  │  ├─ security-validation.service.ts    #   reusable validation layer (SSRF/redirect/traversal/CSV/method)
│  │  ├─ key-management.service.ts         #   versioned key registry + rotation + expiry monitoring
│  │  ├─ encryption.service.ts             #   AES-256-GCM field/token encryption
│  │  ├─ encrypted-column.transformer.ts   #   TypeORM transformer (ready for sensitive columns)
│  │  ├─ security-policy.service.ts        #   central lockout + threat thresholds (from settings)
│  │  ├─ threat-detection.service.ts       #   failed-login/lockout/stuffing/suspicious-login/scoring
│  │  ├─ security-audit.service.ts         #   security-event facade → immutable audit_logs + metrics
│  │  ├─ security-platform.service.ts      #   umbrella facade + posture snapshot
│  │  ├─ security-admin.controller.ts      #   GET /admin/security/{status,keys}
│  │  └─ security.module.ts
│  ├─ modules/privacy/                      # + PRIVACY PLATFORM (GDPR)
│  │  ├─ privacy.constants.ts              #   consent purposes/states, DSR kinds, retention registry
│  │  ├─ consent.service.ts                #   consent (durable Redis + immutable audit)
│  │  ├─ data-subject.service.ts           #   export (Art.15) + erasure (Art.17) via contributor ports
│  │  ├─ privacy.controller.ts             #   GET/PUT /me/privacy/consent, /export, /erasure, /requests
│  │  └─ privacy.module.ts
│  ├─ modules/compliance/                   # + COMPLIANCE PLATFORM
│  │  ├─ compliance.service.ts             #   report + retention + framework readiness + legal-hold seam
│  │  ├─ compliance.controller.ts          #   GET /admin/compliance/{report,retention}
│  │  └─ compliance.module.ts
│  ├─ modules/audit/audit.constants.ts      # ~ category-by-prefix (security/privacy); + Privacy category
│  ├─ modules/audit/audit.service.ts        # ~ actorId nullable (system/anonymous security events)
│  ├─ modules/auth/auth.service.ts          # ~ login: lockout gate + threat-detection wiring
│  ├─ modules/admin/admin-users.controller.ts # ~ role changes are super_admin-only (privilege-escalation fix)
│  ├─ modules/admin/admin.exceptions.ts     # ~ + RoleAssignmentForbiddenException
│  └─ infrastructure/monitoring/metrics.service.ts # ~ generic security counters through /metrics
├─ .github/workflows/
│  ├─ ci.yml                               # ~ + license audit (supply chain)
│  └─ codeql.yml                           # + CodeQL SAST (JS/TS)
qalam-mobile/                               # Flutter security verify + hardening (seams) — docs/<mobile>
platfrom/admin/src/features/security/       # + admin Security / Compliance / Privacy dashboards
platfrom/docs/42                            # + this document
```

Legend: `+` new, `~` changed.

---

## 2. Security Platform architecture

A `@Global` module — every service is injectable everywhere, so security is reached in one place and never re-implemented:

| Service                     | Responsibility                                                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SecurityValidationService` | The reusable **Security Validation Layer** — SSRF-safe outbound URLs, open-redirect-safe return paths, path-traversal-safe segments, CSV-formula neutralization, HTTP-method validation. Pure + synchronous. |
| `SecurityPolicyService`     | Central **Security Policy Service** — resolves account-lockout thresholds (admin-tunable via `security.maxLoginAttempts`/`lockoutDurationMinutes` settings) + threat thresholds.                             |
| `KeyManagementService`      | Versioned key registry, active-key selection, rotation overlap, expiry monitoring — the **KMS integration seam**.                                                                                            |
| `EncryptionService`         | AES-256-GCM authenticated field/token encryption; self-describing versioned envelope; fails closed on tamper.                                                                                                |
| `ThreatDetectionService`    | Failed-login tracking, account lockout, credential-stuffing + suspicious-login + brute-force detection, threat scoring, event classification.                                                                |
| `SecurityAuditService`      | The **Security Audit Service** — records every security event immutably to `audit_logs` + increments the matching security metric.                                                                           |
| `SecurityPlatformService`   | Umbrella facade + admin posture snapshot.                                                                                                                                                                    |

**Central point, no duplication:** authorization → Policy Engine; premium access → Entitlement Service; rate limiting → RateLimitGuard; input DTO validation → global `ValidationPipe`; the append-only trail → `audit_logs`. The Security Platform orchestrates these; it owns only the cross-cutting concerns above. **Fail-closed** everywhere (validators return null/deny, encryption throws on tamper, config fails boot).

---

## 3. Authentication security summary

Baseline (already built, docs 13 §3, verified): argon2id, access+rotating-refresh with **token-family reuse detection** (Redis DB 3), **session-version (`sv`) revocation** ("log out everywhere"), OAuth code+PKCE+state+exact redirect, no user-enumeration (constant-time), login rate-limit tiers.

P7.2 additions:

- **Account lockout** — `AuthService.login` now consults `ThreatDetectionService.lockoutState` _before_ verifying the password and records each failure. After `security.maxLoginAttempts` failures the source is locked for `lockoutDurationMinutes`. Lockout is keyed by **ip+email** (not the bare account) so a third party cannot lock a victim out (honors docs 13 §8 "rate-limit over lockout, no victim DoS") while still enforcing a lockout rule.
- **Threat detection on login** — failures feed credential-stuffing (one IP → many accounts), brute-force, and (on success) suspicious-new-device detection; the previously-stubbed admin `failedLogins` view is now backed by real counts.
- **Session revocation** — `sv` + family revocation implement docs 13 §3.6; a revoked ordinary session can read public content for ≤ the 15-min access TTL (documented trade), never reach admin/account-mutation surfaces.
- **MFA / risk-based auth / device-session listing** — extension points (`LoginContext` carries device+ip; the threat service scores them). No architectural change needed to add TOTP/passkeys/step-up.

## 4. Authorization security summary

- **Policy Engine = SSOT** (docs on AF6): `evaluate`/`assert`/`explain`, ordered pure-rule pipeline, self-registered ports (trust/membership/entitlement/feature-flag), **default-deny fallback**, and **audit-on-deny** for notable outcomes. Every collaborative/publishing/moderation write authorizes through it.
- **RBAC + PBAC** — global default-deny `JwtAuthGuard`; `RolesGuard` (ladder min-floor); `@Permissions` + global permission guard; `VisibilityService` for content reads; service-layer ownership checks (horizontal authz).
- **Privilege-escalation prevention (P7.2 fix)** — role changes were gated only by the admin-level `UserUpdate` capability, so an `admin` could mint another admin/super_admin. Now **role assignment is super_admin-only** (`RoleAssignmentForbiddenException`), matching docs 13 §4.1; self-role-change already blocked. Never trust client authorization — the subject is always the JWT `sub`.

## 5. API security summary

- **Request size limits (new)** — an explicit 2 MiB Content-Length guard rejects oversized JSON/form bodies before parsing; multipart uploads (their own multer caps) and the raw-body webhook path are exempt.
- **Security headers (new/tuned)** — API CSP locked to `default-src 'none'; frame-ancestors 'none'`, `Permissions-Policy` denies camera/mic/geo/payment/usb, frameguard `DENY`, plus the P7.1 HSTS/Referrer/CORP.
- **CORS pinned** — explicit origin allowlist + `methods` + `allowedHeaders` (incl. `Idempotency-Key`), `credentials`, `maxAge`; never reflected.
- **Rate limiting** — global sliding-window `RateLimitGuard` (per-tier), the rate-limit floor; adaptive rate limiting is a threat-score-driven seam.
- **Replay/idempotency** — payment webhooks already do HMAC + 300 s replay window + provider-event-id idempotency (AF5); OAuth uses state/PKCE nonce. General-API **idempotency + nonce + request-signing are seams** (constants + Redis namespaces reserved: `sec:idem:`, `sec:nonce:`) to activate per-route without architectural change.
- **Injection/SSRF/traversal/XXE** — closed (docs 13 §6/§9 A10): TypeORM parameterization only, `websearch_to_tsquery`, no `child_process`/user-URL-fetch/XML; the validation layer adds reusable guards for any future surface.

## 6. Privacy architecture (GDPR)

- **Consent** — per-purpose (analytics / marketing / AI-personalization / cookies), **opt-in default**; current state in durable Redis, every grant/withdrawal an immutable `audit_logs` record (the legal proof, 7-year retention).
- **Data export (Art. 15)** — `DataSubjectService.export` assembles consent + audit trail + every self-registered module contributor (the same self-registering-port pattern as the Policy Engine — modules join without the platform importing them). Self-service at `GET /me/privacy/export`.
- **Right to erasure (Art. 17)** — orchestrated across registered erasure contributors + consent clearing; the append-only audit trail is exempt (legal-basis retention). `POST /me/privacy/erasure`.
- **Data minimization + retention** — a declarative **retention registry** (`privacy.constants.ts`) mapping each data category to its window + basis, backed by the existing RETENTION_* cleanup jobs.
- A user acts only on **their own** data — subject id is the JWT `sub`, never the body.

## 7. Compliance architecture

- **Compliance report** (`GET /admin/compliance/report`) — aggregates the security posture, audit activity, retention registry, framework readiness, and data-subject rights; generation is itself audited.
- **Framework readiness** — **GDPR supported today**; CCPA, data-residency, legal-hold, SOC 2 / ISO 27001, PCI-DSS are architected as **extension points** (e.g. PCI scope is minimal — no card data stored, provider-hosted checkout). Each slots in with no structural change (future-compatibility mandate).
- **Legal hold** — seam: flag a subject; erasure contributors honor it.

## 8. Audit architecture

- **Immutable, append-only** `audit_logs` (docs 13 §11): INSERT-only entity (no `updated_at`/`deleted_at`), excluded from retention pruning, no FK (survives hard-deleted users); the app DB role holds **no UPDATE/DELETE grant** (infra control — see the key-rotation/ops note).
- **Cross-domain coverage** — admin mutations (E12.5), moderation, policy-engine denials, and now **security events** (auth failures, lockouts, credential-stuffing, suspicious logins, authz denials, replay blocks) + **privacy/compliance events** (consent, export, erasure, reports) all flow through `AuditService`/`SecurityAuditService`. The category is derived by action prefix (`auth|authz|security|threat` → _security_; `privacy|compliance|data` → _privacy_), so new codes need no map edit.
- Surfaced read-only in the admin **Audit Viewer** (E12.7) with category filters + the new Security/Compliance/Privacy dashboards.

## 9. Threat model summary

Per **docs 13 §2** (STRIDE-lite, per-asset): accounts, unpublished drafts, private-account content, admin panel, media storage, the API. P7.2 operationalizes the mitigations with live detection + scoring: credential-stuffing, brute-force, suspicious-login, authz-failure, rate-limit-violation, replay, privilege-escalation — each classified (`SECURITY_EVENT_TYPE`), level-weighted into a rolling threat score, immutably audited, and metered. **Automated response** (block/step-up) is a documented future extension point off the threat score.

## 10. Flutter security summary

The mobile app (M10/P7.1 hardened) carries security as seams (`abstract interface` + `Noop`, activated in `bootstrap.dart`): secure storage, certificate-pinning, biometric gate, device-integrity, and flavor-gated **secure logging with PII/secret redaction** (mirrors the backend Pino redact list). P7.2 verifies these are wired and adds/verifies the screenshot-protection hook. Details: the mobile security doc in `qalam-mobile/docs`.

## 11. Documentation summary

| Doc                                   | Covers                                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **42** (this)                         | Security Platform architecture, all P7.2 summaries, folder tree, test coverage, manual verification, key-rotation + privacy + compliance guides, OWASP mapping, checklist |
| 13 (existing)                         | Security architecture, STRIDE threat model, OWASP Top-10 mapping, secrets rotation policy, audit design, incident-response basics — still authoritative                   |
| 14 (existing)                         | Logging/monitoring, redaction contract, alerting table                                                                                                                    |
| 40 (P7.1)                             | Config/secrets/environments (container secrets, config-health)                                                                                                            |
| `qalam-mobile/docs/<mobile-security>` | Flutter secure storage / pinning / biometric / screenshot / logging                                                                                                       |

### OWASP ASVS / Top-10 (2021) coverage

Top-10 mapping is in **docs 13 §9** (A01–A10). P7.2 strengthens: A01 (privilege-escalation fix; Policy Engine SSOT), A02 (AES-256-GCM field encryption + key rotation), A04 (threat model operationalized), A05 (tuned CSP/Permissions-Policy/size limits), A07 (account lockout + threat detection), A09 (security events → immutable audit + metrics), A10 (SSRF validation layer). ASVS L1/L2 controls — session management, access control, validation, cryptography, error/logging, data protection — are satisfied by the guards + Security Platform + audit; formal ASVS attestation is external.

### Key-rotation guide

Rotation policy: **docs 13 §10**. Field-encryption keys (P7.2): keys are versioned via `ENCRYPTION_KEYS="1:<b64>,2:<b64>"` + `ENCRYPTION_ACTIVE_KEY_ID`. To rotate: (1) add a new key id (keep the old), (2) set it active — new writes use it, old ciphertext still decrypts (overlap), (3) run a background `reencrypt` sweep, (4) drop the retired key once no ciphertext references it. `KeyManagementService.statuses()` + `ENCRYPTION_KEY_MAX_AGE_DAYS` drive expiry monitoring; the admin `/admin/security/keys` view surfaces age. JWT/S3/DB rotation follow the overlap patterns in docs 13 §10. Container-secret files (P7.1) make rotation a file swap + rolling deploy.

### Privacy & compliance guide

Consent, export, and erasure are self-service under `/me/privacy/*`; admins read compliance posture at `/admin/compliance/*`. To include a new data domain in export/erasure, implement `PrivacyDataContributor` and self-register it in the module's `onModuleInit` — no platform change. Retention windows live in the registry + RETENTION_* env.

---

## 12. Security test coverage

- **798 backend unit tests pass** (+19 P7.2). New: `security-validation.service.spec.ts` (SSRF/redirect/traversal/CSV/method), `encryption.service.spec.ts` (round-trip, tamper-fail-closed, key rotation overlap, rotated-out key), `key-management.service.ts` coverage (load/reject-bad-length/inert), `threat-detection.service.spec.ts` (lockout after N, failure clearing, suspicious new-device, failed-login counts). Existing auth/authz/rate-limit/validation suites unchanged and green.
- `nest build` succeeds; `eslint` 0 errors.
- CI adds CodeQL SAST + license audit on top of the P7.1 gitleaks / Trivy / SBOM / `pnpm audit`.

## 13. Manual security verification guide

```bash
cd platfrom/backend && pnpm typecheck && pnpm lint && pnpm test && pnpm build

# Account lockout (repeat > security.maxLoginAttempts against one ip+email → 429):
for i in $(seq 1 6); do curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST localhost:4000/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"x@example.com","password":"wrong"}'; done   # last → 429

# Headers present:
curl -sI localhost:4000/api/v1/health | grep -iE 'permissions-policy|content-security-policy|x-frame-options'

# Oversized body rejected (413):
head -c 3000000 /dev/zero | tr '\0' 'a' | curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST localhost:4000/api/v1/... -H 'content-type: application/json' --data-binary @-

# Privilege escalation blocked: an admin (not super_admin) PATCHing a user role → 403.
# Privacy self-service (authenticated): GET /api/v1/me/privacy/consent · GET /me/privacy/export
# Admin posture: GET /api/v1/admin/security/status · GET /api/v1/admin/compliance/report
# Field encryption round-trip + tamper-fail: npx jest src/modules/security
```

**Failure-mode expectations** (verified): invalid/expired JWT → 401; revoked session → refresh 401 + admin/sensitive blocked; replay (payment webhook) → rejected outside 300 s; privilege-escalation attempt → 403 (audited); malformed request → 400 `VALIDATION_FAILED`; large payload → 413; rate-limit abuse → 429; lockout → 429; missing required secret (protected tier) → boot abort (P7.1); tampered ciphertext → decryption throws (fail closed).

---

## 14. Centralization confirmation

✅ All platform security validation is **centralized within the Security Platform** (`modules/security`) — the reusable validation layer, security policy, threat detection, encryption/key-management, and the security-audit facade — with **no architectural duplication**. The **Policy Engine remains the SSOT for authorization**, the **Entitlement Service the SSOT for premium access**, the **RateLimitGuard the rate-limit floor**, and **`audit_logs` the single immutable trail**. Every write is authenticated (global default-deny) and authorized; security **fails closed**; audit records are immutable; and the design accommodates future MFA / passkeys / hardware keys / SSO / OIDC / SAML / SOC2 / ISO 27001 / PCI-DSS / regional compliance without architectural change.

> P7.2 ends here. **P7.3 is not started** (load testing, performance/caching optimization, distributed tracing, metrics dashboards, alerting, and incident management belong to later Phase 7 epics).
