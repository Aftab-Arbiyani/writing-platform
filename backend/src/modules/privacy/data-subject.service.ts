import { Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { RedisService } from '../../redis/redis.service';
import type { AuditContext } from '../audit/audit.service';
import { AuditService } from '../audit/audit.service';
import { SecurityAuditService } from '../security/security-audit.service';
import { SECURITY_ACTIONS, THREAT_LEVEL } from '../security/security.constants';
import { ConsentService } from './consent.service';
import { DSR_KIND, DSR_STATUS, PRIVACY_REDIS, type DsrKind } from './privacy.constants';
import type {
  DataExportBundle,
  DataExportSection,
  DataSubjectRequestRecord,
  PrivacyDataContributor,
} from './privacy.types';

/**
 * Data-Subject-Request orchestration (P7.2 — GDPR Art. 15 export + Art. 17
 * erasure). Modules SELF-REGISTER a {@link PrivacyDataContributor} so their data
 * is included/erased without the Privacy Platform importing them (the same
 * self-registering-port pattern as the Policy Engine — extensible, no cycles).
 * The platform always includes its own consent + audit sections. Every request
 * and fulfilment is recorded immutably; the live status is kept in Redis.
 */
@Injectable()
export class DataSubjectService {
  private readonly logger = new Logger(DataSubjectService.name);
  private readonly redis: Redis;
  private readonly contributors: PrivacyDataContributor[] = [];

  constructor(
    redisService: RedisService,
    private readonly consent: ConsentService,
    private readonly audit: AuditService,
    private readonly securityAudit: SecurityAuditService,
  ) {
    this.redis = redisService.getClient('auth');
  }

  /** Called by a contributing module's onModuleInit to join export/erasure. */
  registerContributor(contributor: PrivacyDataContributor): void {
    this.contributors.push(contributor);
  }

  /** Assemble a subject's full data export (GDPR Art. 15). */
  async export(subjectId: string, ctx?: AuditContext): Promise<DataExportBundle> {
    await this.recordRequest(subjectId, DSR_KIND.Export, DSR_STATUS.Requested, ctx);

    const sections: DataExportSection[] = [
      { key: 'consent', label: 'Consent', records: await this.consent.getConsent(subjectId) },
      {
        key: 'audit',
        label: 'Account activity (audit trail)',
        records: await this.audit.recentForUser(subjectId, 500),
      },
    ];

    for (const contributor of this.contributors) {
      if (contributor.exportFor === undefined) continue;
      try {
        sections.push({
          key: contributor.key,
          label: contributor.label,
          records: await contributor.exportFor(subjectId),
        });
      } catch (error) {
        this.logger.warn(
          `export contributor "${contributor.key}" failed: ${(error as Error).message}`,
        );
        sections.push({
          key: contributor.key,
          label: contributor.label,
          records: { error: 'unavailable' },
        });
      }
    }

    const bundle: DataExportBundle = {
      subjectId,
      generatedAt: new Date().toISOString(),
      sections,
    };
    await this.recordRequest(subjectId, DSR_KIND.Export, DSR_STATUS.Fulfilled, ctx);
    await this.securityAudit.record({
      action: SECURITY_ACTIONS.DataExportFulfilled,
      level: THREAT_LEVEL.Info,
      actorId: subjectId,
      actorRole: 'user',
      targetType: 'privacy_dsr',
      targetId: subjectId,
      metadata: { sections: sections.map((s) => s.key) },
      context: ctx,
    });
    return bundle;
  }

  /**
   * Execute right-to-erasure across registered contributors (Art. 17). Erasure
   * is destructive, so callers gate it behind confirmation/fresh-session; the
   * append-only audit trail itself is exempt (legal-basis retention, docs 13
   * §11) — only the referenced content/PII is erased/anonymized.
   */
  async erase(
    subjectId: string,
    ctx?: AuditContext,
  ): Promise<{ erased: string[]; failed: string[] }> {
    await this.recordRequest(subjectId, DSR_KIND.Erasure, DSR_STATUS.Requested, ctx);
    await this.securityAudit.record({
      action: SECURITY_ACTIONS.DataErasureRequested,
      level: THREAT_LEVEL.Medium,
      actorId: subjectId,
      actorRole: 'user',
      targetType: 'privacy_dsr',
      targetId: subjectId,
      context: ctx,
    });

    const erased: string[] = [];
    const failed: string[] = [];
    for (const contributor of this.contributors) {
      if (contributor.erase === undefined) continue;
      try {
        await contributor.erase(subjectId);
        erased.push(contributor.key);
      } catch (error) {
        this.logger.warn(
          `erasure contributor "${contributor.key}" failed: ${(error as Error).message}`,
        );
        failed.push(contributor.key);
      }
    }
    // Consent state is cleared as part of erasure (the audit record persists).
    await this.redis.del(`${PRIVACY_REDIS.consentPrefix}${subjectId}`);

    await this.recordRequest(subjectId, DSR_KIND.Erasure, DSR_STATUS.Fulfilled, ctx);
    await this.securityAudit.record({
      action: SECURITY_ACTIONS.DataErasureFulfilled,
      level: THREAT_LEVEL.Medium,
      actorId: subjectId,
      actorRole: 'user',
      targetType: 'privacy_dsr',
      targetId: subjectId,
      metadata: { erased, failed },
      context: ctx,
    });
    return { erased, failed };
  }

  /** Latest request status per kind (for the user's privacy screen). */
  async status(subjectId: string): Promise<DataSubjectRequestRecord[]> {
    const raw = await this.redis.hgetall(`${PRIVACY_REDIS.dsrPrefix}${subjectId}`);
    return (Object.keys(DSR_KIND) as (keyof typeof DSR_KIND)[])
      .map((k) => DSR_KIND[k])
      .flatMap((kind) => {
        const value = raw[kind];
        if (value === undefined) return [];
        const [status, requestedAt, fulfilledAt] = value.split('|');
        return [
          {
            subjectId,
            kind,
            status: (status ?? DSR_STATUS.Requested) as DataSubjectRequestRecord['status'],
            requestedAt: requestedAt ?? '',
            fulfilledAt: fulfilledAt === '' || fulfilledAt === undefined ? null : fulfilledAt,
          },
        ];
      });
  }

  private async recordRequest(
    subjectId: string,
    kind: DsrKind,
    status: (typeof DSR_STATUS)[keyof typeof DSR_STATUS],
    ctx?: AuditContext,
  ): Promise<void> {
    const now = new Date().toISOString();
    const fulfilledAt = status === DSR_STATUS.Fulfilled ? now : '';
    await this.redis.hset(
      `${PRIVACY_REDIS.dsrPrefix}${subjectId}`,
      kind,
      `${status}|${now}|${fulfilledAt}`,
    );
    if (status === DSR_STATUS.Requested && kind === DSR_KIND.Export) {
      await this.securityAudit.record({
        action: SECURITY_ACTIONS.DataExportRequested,
        level: THREAT_LEVEL.Info,
        actorId: subjectId,
        actorRole: 'user',
        targetType: 'privacy_dsr',
        targetId: subjectId,
        context: ctx,
      });
    }
  }
}
