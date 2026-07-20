/**
 * Wire + view types for the Security / Compliance / Privacy feature (P7.2). Mirror the backend
 * P7.2 admin DTOs (`backend/src/modules/security/security-admin.controller.ts` +
 * `security-platform.service.ts` + `key-management.service.ts`,
 * `backend/src/modules/compliance/compliance.service.ts`, and the privacy vocabulary in
 * `backend/src/modules/privacy/privacy.constants.ts`). Hand-authored until `@qalam/api-types`
 * covers them — only the fields the views read are declared (extra response fields are ignored by
 * structural typing). Never carries a secret or key material — status only.
 */

/** Account-lockout policy (backend `SecurityPlatformStatus.lockout`). */
export interface LockoutPolicy {
  enabled: boolean;
  maxAttempts: number;
  lockoutMinutes: number;
}

/** Threat-detection trigger thresholds (backend `SecurityPlatformStatus.threatThresholds`). */
export interface ThreatThresholds {
  stuffingDistinctAccounts: number;
  bruteForceAttempts: number;
  highRiskScore: number;
}

/** `GET /admin/security/status` — non-secret security posture snapshot. */
export interface SecurityStatus {
  encryptionEnabled: boolean;
  keyCount: number;
  lockout: LockoutPolicy;
  threatThresholds: ThreatThresholds;
  controls: string[];
}

/** One encryption key's non-secret status — NEVER its material (backend `KeyStatus`). */
export interface KeyStatus {
  id: string;
  active: boolean;
  algorithm: string;
  /** Key length in bytes (aes-256-gcm → 32). */
  length: number;
}

/** `GET /admin/security/keys` — rotation policy + per-key status. */
export interface KeyStatusReport {
  maxKeyAgeDays: number;
  keys: KeyStatus[];
}

/** Readiness of a compliance framework (backend `FrameworkReadiness`). */
export type FrameworkStatus = 'supported' | 'extension_point';

export interface ComplianceFramework {
  framework: string;
  status: FrameworkStatus;
  notes: string;
}

/** One data-retention registry entry (backend `RetentionRule`). */
export interface RetentionRule {
  category: string;
  retention: string;
  basis: string;
}

/** Rolling audit-activity counts (backend `ComplianceReport.audit`). */
export interface AuditActivity {
  today: number;
  thisWeek: number;
  thisMonth: number;
}

/** `GET /admin/compliance/report` — the full compliance snapshot. */
export interface ComplianceReport {
  generatedAt: string;
  environment: string;
  security: SecurityStatus;
  audit: AuditActivity;
  retention: RetentionRule[];
  frameworks: ComplianceFramework[];
  dataSubjectRights: string[];
}

/** `GET /admin/compliance/retention` — frameworks + retention registry. */
export interface RetentionReport {
  frameworks: ComplianceFramework[];
  retention: RetentionRule[];
}

/**
 * Consent-purpose catalog for the Privacy overview. There is NO admin per-user consent endpoint
 * (consent is user-scoped, durable in Redis with an immutable audit record) — this static catalog
 * mirrors the backend `CONSENT_PURPOSE` vocabulary so admins can see what the platform tracks.
 */
export interface ConsentPurposeInfo {
  key: string;
  label: string;
  description: string;
}

/** A data-subject-request kind for the Privacy DSR explainer (mirrors backend `DSR_KIND`). */
export interface DsrKindInfo {
  key: string;
  label: string;
  article: string;
  description: string;
}
