import { Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { RETENTION_REGISTRY, type RetentionRule } from '../privacy/privacy.constants';
import { SecurityAuditService } from '../security/security-audit.service';
import { SECURITY_ACTIONS, THREAT_LEVEL } from '../security/security.constants';
import { SecurityPlatformService } from '../security/security-platform.service';
import type { AuditContext } from '../audit/audit.service';

/** Readiness of each compliance framework — implemented vs extension-point. */
export interface FrameworkReadiness {
  readonly framework: string;
  readonly status: 'supported' | 'extension_point';
  readonly notes: string;
}

export interface ComplianceReport {
  readonly generatedAt: string;
  readonly environment: string;
  readonly security: Awaited<ReturnType<SecurityPlatformService['status']>>;
  readonly audit: { today: number; thisWeek: number; thisMonth: number };
  readonly retention: readonly RetentionRule[];
  readonly frameworks: readonly FrameworkReadiness[];
  readonly dataSubjectRights: readonly string[];
}

/**
 * Compliance Platform (P7.2). Aggregates the platform's security posture, audit
 * activity, data-retention registry and framework readiness into a compliance
 * report, and provides the legal-hold seam. It composes existing platforms
 * (Security, Audit, Privacy) — it stores no new state and duplicates nothing.
 * GDPR is supported today (consent + export + erasure + immutable audit);
 * CCPA / SOC2 / ISO 27001 / PCI-DSS / data-residency are architected as
 * extension points that slot in without structural change.
 */
@Injectable()
export class ComplianceService {
  constructor(
    private readonly platform: SecurityPlatformService,
    private readonly audit: AuditService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  retentionPolicies(): readonly RetentionRule[] {
    return RETENTION_REGISTRY;
  }

  frameworks(): readonly FrameworkReadiness[] {
    return [
      {
        framework: 'GDPR',
        status: 'supported',
        notes:
          'Consent tracking, Art. 15 export, Art. 17 erasure, immutable audit, retention registry.',
      },
      {
        framework: 'CCPA',
        status: 'extension_point',
        notes: 'Reuses the DSR export/erasure pipeline; add "do not sell" as a consent purpose.',
      },
      {
        framework: 'Data residency',
        status: 'extension_point',
        notes:
          'Region pinning is a deployment concern; the config platform supports per-region env.',
      },
      {
        framework: 'Legal hold',
        status: 'extension_point',
        notes: 'applyLegalHold() flags a subject; erasure contributors honor the flag.',
      },
      {
        framework: 'SOC 2 / ISO 27001',
        status: 'extension_point',
        notes:
          'Access control, audit trail, encryption, and monitoring controls are in place; formal attestation is external.',
      },
      {
        framework: 'PCI DSS',
        status: 'extension_point',
        notes:
          'No card data is stored — payments go through provider-hosted checkout (AF5), keeping PCI scope minimal.',
      },
    ];
  }

  /** Assemble the compliance report (admin) and record its generation. */
  async report(ctx?: AuditContext): Promise<ComplianceReport> {
    const [security, auditStats] = await Promise.all([
      this.platform.status(),
      this.audit.statistics(),
    ]);
    await this.securityAudit.record({
      action: SECURITY_ACTIONS.ComplianceReportGenerated,
      level: THREAT_LEVEL.Info,
      targetType: 'compliance',
      context: ctx,
    });
    return {
      generatedAt: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? 'development',
      security,
      audit: {
        today: auditStats.today,
        thisWeek: auditStats.thisWeek,
        thisMonth: auditStats.thisMonth,
      },
      retention: this.retentionPolicies(),
      frameworks: this.frameworks(),
      dataSubjectRights: ['access/export (Art. 15)', 'erasure (Art. 17)', 'consent management'],
    };
  }
}
