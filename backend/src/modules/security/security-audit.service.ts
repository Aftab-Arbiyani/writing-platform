import { Injectable, Logger } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import type { AuditContext } from '../audit/audit.service';
import { MetricsService } from '../../infrastructure/monitoring/metrics.service';
import { SECURITY_METRICS } from './security.constants';
import type { SecurityAction, SecurityEventType, ThreatLevel } from './security.constants';

/** One security event to record immutably + count. */
export interface SecurityEvent {
  action: SecurityAction;
  level: ThreatLevel;
  eventType?: SecurityEventType;
  /** The user the event concerns; null for anonymous/system. */
  actorId?: string | null;
  actorRole?: string | null;
  targetType?: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  context?: AuditContext;
  /** Optional Prometheus counter to bump (defaults to threatEvents). */
  metric?: string;
  metricLabels?: Record<string, string>;
}

/**
 * Security Audit Service (P7.2). The single choke point for recording
 * security-relevant events — auth failures, lockouts, authorization denials,
 * threat detections, replay blocks, privacy/compliance actions. It writes an
 * IMMUTABLE row to the shared append-only `audit_logs` (via {@link AuditService})
 * AND increments the matching security metric through the existing registry.
 *
 * It never duplicates the audit table; it is a thin, security-flavoured facade
 * so no domain writes security events ad hoc. Failures to audit are logged but
 * never throw into the caller's hot path (a security event must not break the
 * request that triggered it — the metric + structured log remain as backstops).
 */
@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);

  constructor(
    private readonly audit: AuditService,
    private readonly metrics: MetricsService,
  ) {}

  async record(event: SecurityEvent): Promise<void> {
    // Metric first — cheap, in-memory, never fails.
    this.metrics.incrementSecurity(event.metric ?? SECURITY_METRICS.threatEvents, {
      action: event.action,
      level: event.level,
      ...(event.eventType !== undefined ? { type: event.eventType } : {}),
      ...event.metricLabels,
    });

    try {
      await this.audit.record({
        actorId: event.actorId ?? null,
        actorRole: event.actorRole ?? 'system',
        action: event.action,
        targetType: event.targetType ?? 'security',
        targetId: event.targetId ?? null,
        metadata: {
          level: event.level,
          ...(event.eventType !== undefined ? { eventType: event.eventType } : {}),
          ...event.metadata,
        },
        context: event.context,
      });
    } catch (error) {
      // A structured warn line is the backstop; the metric already counted it.
      this.logger.warn(
        `security.audit.persist_failed action=${event.action} level=${event.level}: ${(error as Error).message}`,
      );
    }
  }
}
