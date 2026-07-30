import { Injectable, Logger, Optional } from '@nestjs/common';

import { SettingsService } from '../settings/settings.service';

/** Effective account-lockout policy (admin-tunable via settings, safe defaults). */
export interface LockoutPolicy {
  readonly enabled: boolean;
  readonly maxAttempts: number;
  readonly lockoutMinutes: number;
}

/** Static threat-detection thresholds (tuned in code; not hot-path settings). */
export interface ThreatThresholds {
  /** Distinct accounts a single IP may fail against before credential-stuffing fires. */
  readonly stuffingDistinctAccounts: number;
  /** Failures within the window before a brute-force signal fires. */
  readonly bruteForceAttempts: number;
  /** Rolling threat score at/above which a subject is treated as high-risk. */
  readonly highRiskScore: number;
}

const DEFAULT_LOCKOUT: LockoutPolicy = { enabled: true, maxAttempts: 5, lockoutMinutes: 15 };
const THREAT_THRESHOLDS: ThreatThresholds = {
  stuffingDistinctAccounts: 10,
  bruteForceAttempts: 10,
  highRiskScore: 100,
};

/**
 * Security Policy Service (P7.2). The central place security *policy values*
 * are resolved — account-lockout thresholds (admin-tunable through the existing
 * settings catalog: `security.maxLoginAttempts` / `security.lockoutDurationMinutes`)
 * and the threat-detection thresholds. Consumers ask here rather than reading
 * settings or hard-coding numbers, so the policy is defined once.
 *
 * `SettingsService` is optional so the Security Platform (and its unit tests)
 * run standalone with safe defaults when settings are not wired.
 */
@Injectable()
export class SecurityPolicyService {
  private readonly logger = new Logger(SecurityPolicyService.name);

  constructor(@Optional() private readonly settings?: SettingsService) {}

  /** Resolve the effective lockout policy from settings, falling back to defaults. */
  async lockoutPolicy(): Promise<LockoutPolicy> {
    if (this.settings === undefined) return DEFAULT_LOCKOUT;
    try {
      const [maxAttempts, lockoutMinutes] = await Promise.all([
        this.settings.getValue('security.maxLoginAttempts'),
        this.settings.getValue('security.lockoutDurationMinutes'),
      ]);
      return {
        enabled: DEFAULT_LOCKOUT.enabled,
        maxAttempts: this.asPositiveInt(maxAttempts, DEFAULT_LOCKOUT.maxAttempts),
        lockoutMinutes: this.asPositiveInt(lockoutMinutes, DEFAULT_LOCKOUT.lockoutMinutes),
      };
    } catch (error) {
      this.logger.warn(`lockout policy read failed, using defaults: ${(error as Error).message}`);
      return DEFAULT_LOCKOUT;
    }
  }

  /** Threat-detection thresholds (static; single source of truth). */
  threatThresholds(): ThreatThresholds {
    return THREAT_THRESHOLDS;
  }

  private asPositiveInt(value: unknown, fallback: number): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(n) && n > 0 ? n : fallback;
  }
}
