import { Injectable } from '@nestjs/common';

import { EncryptionService } from './encryption.service';
import { KeyManagementService } from './key-management.service';
import { SecurityAuditService } from './security-audit.service';
import { SecurityPolicyService } from './security-policy.service';
import { SecurityValidationService } from './security-validation.service';
import { ThreatDetectionService } from './threat-detection.service';

/** Non-secret snapshot of Security Platform posture (admin security dashboard). */
export interface SecurityPlatformStatus {
  readonly encryptionEnabled: boolean;
  readonly keyCount: number;
  readonly lockout: { enabled: boolean; maxAttempts: number; lockoutMinutes: number };
  readonly threatThresholds: {
    stuffingDistinctAccounts: number;
    bruteForceAttempts: number;
    highRiskScore: number;
  };
  readonly controls: readonly string[];
}

/**
 * Security Platform facade (P7.2) — the central point for security policy
 * enforcement. It aggregates the platform's services (validation, encryption,
 * key management, policy, threat detection, security audit) behind one
 * injectable so callers reach security capabilities in one place, and exposes a
 * posture snapshot for the admin security dashboard. It ORCHESTRATES the
 * services; it does not re-implement them (authorization stays in the Policy
 * Engine, premium access in the Entitlement Service, rate limiting in the
 * RateLimitGuard — the Security Platform never duplicates those).
 */
@Injectable()
export class SecurityPlatformService {
  constructor(
    readonly validation: SecurityValidationService,
    readonly encryption: EncryptionService,
    readonly keys: KeyManagementService,
    readonly policy: SecurityPolicyService,
    readonly threats: ThreatDetectionService,
    readonly audit: SecurityAuditService,
  ) {}

  /** Posture snapshot — safe to expose to admins (no secrets, no key material). */
  async status(): Promise<SecurityPlatformStatus> {
    const lockout = await this.policy.lockoutPolicy();
    return {
      encryptionEnabled: this.encryption.enabled,
      keyCount: this.keys.statuses().length,
      lockout,
      threatThresholds: this.policy.threatThresholds(),
      controls: [
        'default-deny-authz',
        'global-rate-limit',
        'refresh-family-reuse-detection',
        'session-version-revocation',
        'account-lockout',
        'threat-detection',
        'field-encryption',
        'immutable-audit',
        'input-validation',
        'security-headers',
        'idempotency-replay-protection',
      ],
    };
  }
}
