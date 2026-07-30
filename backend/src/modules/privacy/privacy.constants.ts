/**
 * Privacy Platform vocabulary (P7.2 — GDPR/CCPA-ready). Consent purposes and
 * data-retention categories. Consent is durable (Redis AOF) with an immutable
 * `audit_logs` record of every change; retention categories map to the
 * platform's RETENTION_* windows.
 */

/** Purposes a user consents to (data minimization: only what we actually use). */
export const CONSENT_PURPOSE = {
  /** Product analytics + engagement metrics. */
  Analytics: 'analytics',
  /** Marketing / lifecycle email beyond transactional. */
  Marketing: 'marketing',
  /** Use of the user's content to improve AI features. */
  AiPersonalization: 'ai_personalization',
  /** Non-essential cookies / client storage. */
  Cookies: 'cookies',
} as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSE)[keyof typeof CONSENT_PURPOSE];

export const ALL_CONSENT_PURPOSES: readonly ConsentPurpose[] = Object.values(CONSENT_PURPOSE);

/** Current state of a consent purpose. */
export const CONSENT_STATE = {
  Granted: 'granted',
  Withdrawn: 'withdrawn',
  /** Never decided — treated as withdrawn (opt-in, GDPR default). */
  Unset: 'unset',
} as const;
export type ConsentState = (typeof CONSENT_STATE)[keyof typeof CONSENT_STATE];

/** A data-subject request kind (GDPR Art. 15 access / Art. 17 erasure). */
export const DSR_KIND = {
  Export: 'export',
  Erasure: 'erasure',
} as const;
export type DsrKind = (typeof DSR_KIND)[keyof typeof DSR_KIND];

export const DSR_STATUS = {
  Requested: 'requested',
  Fulfilled: 'fulfilled',
  Rejected: 'rejected',
} as const;
export type DsrStatus = (typeof DSR_STATUS)[keyof typeof DSR_STATUS];

/** Redis namespaces the Privacy Platform owns (durable via AOF; audit is SSOT). */
export const PRIVACY_REDIS = {
  /** Hash of {purpose -> "granted"|"withdrawn"} per user. */
  consentPrefix: 'privacy:consent:',
  /** Latest data-subject-request status per user+kind. */
  dsrPrefix: 'privacy:dsr:',
} as const;

/**
 * Data-retention registry (P7.2). Declarative record of how long each data
 * category is kept + the mechanism. Backed by the platform's existing
 * RETENTION_* windows + the append-only audit 7-year policy (docs 13 §11).
 */
export interface RetentionRule {
  readonly category: string;
  readonly retention: string;
  readonly basis: string;
}

export const RETENTION_REGISTRY: readonly RetentionRule[] = [
  { category: 'audit_logs', retention: '7 years', basis: 'legal/accountability (docs 13 §11)' },
  { category: 'auth_refresh_families', retention: '30 days (TTL)', basis: 'session lifetime' },
  {
    category: 'expired_auth_tokens',
    retention: 'RETENTION_EXPIRED_TOKEN_DAYS',
    basis: 'cleanup job',
  },
  { category: 'notifications', retention: 'RETENTION_NOTIFICATION_DAYS', basis: 'cleanup job' },
  {
    category: 'soft_deleted_content',
    retention: 'RETENTION_SOFT_DELETE_DAYS',
    basis: 'grace + purge',
  },
  { category: 'threat_signals', retention: '1 hour (TTL)', basis: 'ephemeral detection state' },
  {
    category: 'consent_records',
    retention: '7 years (in audit_logs)',
    basis: 'GDPR consent proof',
  },
];
