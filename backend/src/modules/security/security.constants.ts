/**
 * Security Platform vocabulary (P7.2). The Security Platform is the central
 * point for security policy enforcement, threat classification, and the
 * security audit taxonomy. These constants are the single source of truth for
 * security event codes, threat levels, and the Redis key namespaces the
 * platform owns — reused everywhere so security semantics are never duplicated.
 */

/**
 * Dot-cased security audit action codes persisted verbatim in `audit_logs.action`.
 * They extend the admin `AUDIT_ACTIONS` catalogue with the auth/authz/threat/
 * privacy/compliance events the Security Platform records. `auditCategoryOf`
 * (audit.constants.ts) buckets any `auth.*|security.*|threat.*|authz.*` code
 * under the `security` category and `privacy.*|compliance.*|data.*` under
 * `privacy`, so adding a code here needs no category-map edit.
 */
export const SECURITY_ACTIONS = {
  // ── Authentication ──────────────────────────────────────────────────────
  LoginFailed: 'auth.login.failed',
  AccountLocked: 'auth.account.locked',
  AccountUnlocked: 'auth.account.unlocked',
  SessionRevoked: 'auth.session.revoked',
  SessionExpired: 'auth.session.expired',
  SuspiciousLogin: 'auth.suspicious_login',
  RefreshReuseDetected: 'auth.token.reuse_detected',
  // ── Authorization ───────────────────────────────────────────────────────
  AuthorizationDenied: 'authz.denied',
  PrivilegeEscalationBlocked: 'authz.privilege_escalation_blocked',
  // ── Threat / abuse ──────────────────────────────────────────────────────
  ThreatDetected: 'security.threat.detected',
  RateLimitBreach: 'security.rate_limit.breach',
  CredentialStuffing: 'security.credential_stuffing',
  ReplayBlocked: 'security.replay.blocked',
  // ── Secrets / encryption ────────────────────────────────────────────────
  SecretValidationFailed: 'security.secret.validation_failed',
  EncryptionKeyRotated: 'security.encryption.key_rotated',
  // ── Privacy ─────────────────────────────────────────────────────────────
  ConsentGranted: 'privacy.consent.granted',
  ConsentWithdrawn: 'privacy.consent.withdrawn',
  DataExportRequested: 'privacy.data.export_requested',
  DataExportFulfilled: 'privacy.data.export_fulfilled',
  DataErasureRequested: 'privacy.data.erasure_requested',
  DataErasureFulfilled: 'privacy.data.erasure_fulfilled',
  // ── Compliance ──────────────────────────────────────────────────────────
  ComplianceReportGenerated: 'compliance.report.generated',
  LegalHoldApplied: 'compliance.legal_hold.applied',
} as const;
export type SecurityAction = (typeof SECURITY_ACTIONS)[keyof typeof SECURITY_ACTIONS];

/** Ordered threat severity — the numeric weight feeds threat scoring. */
export const THREAT_LEVEL = {
  Info: 'info',
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Critical: 'critical',
} as const;
export type ThreatLevel = (typeof THREAT_LEVEL)[keyof typeof THREAT_LEVEL];

/** Numeric weight per threat level (used to aggregate a subject's threat score). */
export const THREAT_LEVEL_WEIGHT: Record<ThreatLevel, number> = {
  info: 0,
  low: 10,
  medium: 25,
  high: 50,
  critical: 100,
};

/** Classification of a detected security event (drives dashboards + response). */
export const SECURITY_EVENT_TYPE = {
  AuthFailure: 'auth_failure',
  BruteForce: 'brute_force',
  CredentialStuffing: 'credential_stuffing',
  SuspiciousLogin: 'suspicious_login',
  AuthorizationFailure: 'authorization_failure',
  RateLimitViolation: 'rate_limit_violation',
  ReplayAttack: 'replay_attack',
  PrivilegeEscalation: 'privilege_escalation',
  AbusePattern: 'abuse_pattern',
  SecretValidation: 'secret_validation',
} as const;
export type SecurityEventType = (typeof SECURITY_EVENT_TYPE)[keyof typeof SECURITY_EVENT_TYPE];

/**
 * Redis (DB 3 "auth" — same instance the auth families + rate limiter use)
 * key namespaces the Security Platform owns. All keyed values are ephemeral
 * (TTL'd); the durable record of a security event is the immutable `audit_logs`
 * row written alongside.
 */
export const SECURITY_REDIS = {
  /** Failed-login counter per subject (ip+email / user). */
  loginFailPrefix: 'sec:loginfail:',
  /** Active account-lockout marker. */
  lockoutPrefix: 'sec:lockout:',
  /** Rolling threat-score bucket per subject. */
  threatScorePrefix: 'sec:threat:',
  /** Distinct known devices/IPs per user (suspicious-login baseline). */
  knownDevicePrefix: 'sec:devices:',
  /** Idempotency-Key result cache. */
  idempotencyPrefix: 'sec:idem:',
  /** Seen nonces (replay protection). */
  noncePrefix: 'sec:nonce:',
  /** Distinct accounts a single IP failed against (credential-stuffing signal). */
  stuffingPrefix: 'sec:stuffing:',
} as const;

/** Threat-score window + decay defaults (seconds). */
export const THREAT_SCORE_WINDOW_SECONDS = 3600;
/** Idempotency-Key retention window (seconds). */
export const IDEMPOTENCY_TTL_SECONDS = 86_400;
/** Replay nonce retention window (seconds) — must exceed the timestamp tolerance. */
export const NONCE_TTL_SECONDS = 900;
/** Max clock skew tolerated on a signed/timestamped request (seconds). */
export const REQUEST_TIMESTAMP_TOLERANCE_SECONDS = 300;

/** Security metric names exposed through the existing Prometheus registry. */
export const SECURITY_METRICS = {
  authFailures: 'security_auth_failures_total',
  authzDenials: 'security_authorization_denials_total',
  rateLimitBreaches: 'security_rate_limit_breaches_total',
  threatEvents: 'security_threat_events_total',
  accountLockouts: 'security_account_lockouts_total',
  replayBlocked: 'security_replay_blocked_total',
  secretValidationFailures: 'security_secret_validation_failures_total',
} as const;
