import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';

import { AuditService } from '../../audit/audit.service';
import { getOperationsObserver } from '../../../common/operations/operations-observer.port';
import { AlertingService, type IncidentOpener } from '../alerting/alerting.service';
import { IncidentStore } from './incident-store';
import {
  ALERT_RULE_BY_ID,
  FAILURE_CLASS,
  INCIDENT_SEVERITY,
  INCIDENT_STATUS,
  INCIDENT_TRANSITIONS,
  type FailureClass,
  type IncidentSeverity,
  type IncidentStatus,
} from '../operations.constants';
import { OperationsException } from '../operations.exceptions';
import type { Incident, IncidentTimelineEntry, PostmortemTemplate } from '../operations.types';
import { nowIso, opsId } from '../operations.util';

/** The actor performing an incident action (an admin, or `system`). */
export interface IncidentActor {
  readonly id: string | null;
  readonly role: string | null;
}

const SYSTEM_ACTOR: IncidentActor = { id: null, role: 'system' };

/**
 * Incident Management Service (P7.4) — owns the full incident lifecycle:
 * open → acknowledge → investigate → identify → monitor → resolve, with
 * severity, an immutable timeline, assignment, notes, root-cause + failure
 * classification, recovery verification, and postmortem templates. It ESCALATES
 * from alerting (implements {@link IncidentOpener}, registered on init) and feeds
 * reliability (MTTR/MTBF read the resolved incidents).
 *
 * State is the durable {@link IncidentStore} (durable Redis, no migration); every
 * material action is ALSO written to the immutable `audit_logs` trail — the
 * permanent record — via the shared {@link AuditService}, exactly as admin
 * mutations must (docs 13 §11). This service never touches `audit_logs` directly.
 */
@Injectable()
export class IncidentService implements OnModuleInit, IncidentOpener {
  private readonly logger = new Logger(IncidentService.name);

  constructor(
    private readonly store: IncidentStore,
    private readonly audit: AuditService,
    private readonly alerting: AlertingService,
  ) {}

  /** Register as the alerting escalation target (one-way; no module cycle). */
  onModuleInit(): void {
    this.alerting.registerIncidentOpener(this);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /** Open an incident manually (admin) or from an alert (system). */
  async open(
    input: {
      title: string;
      severity: IncidentSeverity;
      service?: string | null;
      sourceAlertId?: string | null;
    },
    actor: IncidentActor,
  ): Promise<Incident> {
    const now = nowIso();
    const incident: Incident = {
      id: opsId(),
      title: input.title,
      severity: input.severity,
      status: INCIDENT_STATUS.Open,
      service: input.service ?? null,
      assigneeId: null,
      failureClass: null,
      rootCause: null,
      sourceAlertId: input.sourceAlertId ?? null,
      createdAt: now,
      acknowledgedAt: null,
      resolvedAt: null,
      timeToResolveMinutes: null,
      recoveryVerified: false,
      timeline: [entry('opened', `Incident opened (${input.severity})`, actor)],
    };
    await this.store.save(incident);
    await this.record('operations.incident.open', incident, actor, {
      severity: incident.severity,
      sourceAlertId: incident.sourceAlertId,
    });
    getOperationsObserver()?.record({ kind: 'failure', name: 'incident.opened', ok: false });
    return incident;
  }

  /** {@link IncidentOpener} — auto-open a SEV incident from a critical alert. */
  async openFromAlert(alert: { id: string; label: string; category: string }): Promise<void> {
    const existing = await this.store.findOpenBySourceAlert(alert.id);
    if (existing !== null) {
      return; // Already have an open incident for this alert — no duplicate.
    }
    const rule = ALERT_RULE_BY_ID.get(alert.id);
    await this.open(
      {
        title: `[auto] ${alert.label}`,
        severity: INCIDENT_SEVERITY.Sev2,
        service: rule?.category ?? alert.category,
        sourceAlertId: alert.id,
      },
      SYSTEM_ACTOR,
    );
  }

  /** Transition status, validating the lifecycle; stamps ack/resolve timers. */
  async transition(id: string, next: IncidentStatus, actor: IncidentActor): Promise<Incident> {
    const incident = await this.require(id);
    if (incident.status === next) {
      return incident;
    }
    const allowed = INCIDENT_TRANSITIONS[incident.status];
    if (!allowed.includes(next)) {
      throw new OperationsException(
        'OPERATIONS_INVALID_TRANSITION',
        `cannot transition incident from ${incident.status} to ${next}`,
      );
    }
    const now = nowIso();
    const resolving = next === INCIDENT_STATUS.Resolved;
    const patch: Partial<Incident> = {
      status: next,
      acknowledgedAt:
        next === INCIDENT_STATUS.Acknowledged && incident.acknowledgedAt === null
          ? now
          : incident.acknowledgedAt,
      ...(resolving
        ? { resolvedAt: now, timeToResolveMinutes: minutesBetween(incident.createdAt, now) }
        : {}),
    };
    const updated = await this.apply(
      incident,
      patch,
      entry(`status:${next}`, `Status → ${next}`, actor),
    );
    await this.record('operations.incident.transition', updated, actor, { to: next });
    if (next === INCIDENT_STATUS.Resolved) {
      getOperationsObserver()?.record({
        kind: 'failure',
        name: 'incident.resolved',
        ok: true,
        value: updated.timeToResolveMinutes ?? 0,
      });
    }
    return updated;
  }

  /** Assign the incident to a user. */
  async assign(id: string, assigneeId: string, actor: IncidentActor): Promise<Incident> {
    const incident = await this.require(id);
    const updated = await this.apply(
      incident,
      { assigneeId },
      entry('assigned', `Assigned to ${assigneeId}`, actor),
    );
    await this.record('operations.incident.assign', updated, actor, { assigneeId });
    return updated;
  }

  /** Append a free-text note to the timeline. */
  async addNote(id: string, message: string, actor: IncidentActor): Promise<Incident> {
    const incident = await this.require(id);
    const updated = await this.apply(incident, {}, entry('note', message, actor));
    await this.record('operations.incident.note', updated, actor, {});
    return updated;
  }

  /** Resolve with a root cause + failure classification. */
  async resolve(
    id: string,
    input: { rootCause: string; failureClass?: FailureClass },
    actor: IncidentActor,
  ): Promise<Incident> {
    const incident = await this.require(id);
    const now = nowIso();
    const updated = await this.apply(
      incident,
      {
        status: INCIDENT_STATUS.Resolved,
        rootCause: input.rootCause,
        failureClass: input.failureClass ?? FAILURE_CLASS.Unknown,
        resolvedAt: now,
        timeToResolveMinutes: minutesBetween(incident.createdAt, now),
      },
      entry('resolved', `Resolved: ${input.rootCause}`, actor),
    );
    await this.record('operations.incident.resolve', updated, actor, {
      failureClass: updated.failureClass,
      timeToResolveMinutes: updated.timeToResolveMinutes,
    });
    getOperationsObserver()?.record({
      kind: 'failure',
      name: 'incident.resolved',
      ok: true,
      value: updated.timeToResolveMinutes ?? 0,
    });
    return updated;
  }

  /** Mark recovery independently verified (post-resolution check). */
  async verifyRecovery(id: string, actor: IncidentActor): Promise<Incident> {
    const incident = await this.require(id);
    const updated = await this.apply(
      incident,
      { recoveryVerified: true },
      entry('recovery-verified', 'Recovery verified', actor),
    );
    await this.record('operations.incident.recovery_verified', updated, actor, {});
    return updated;
  }

  // ── Reads ───────────────────────────────────────────────────────────────────

  list(): Promise<Incident[]> {
    return this.store.list();
  }

  listOpen(): Promise<Incident[]> {
    return this.store.listOpen();
  }

  get(id: string): Promise<Incident | null> {
    return this.store.get(id);
  }

  /** A postmortem template pre-filled from a resolved incident. */
  async postmortem(id: string): Promise<PostmortemTemplate> {
    const incident = await this.require(id);
    return {
      incidentId: incident.id,
      title: incident.title,
      severity: incident.severity,
      summary: `${incident.title} — ${incident.status}`,
      impact: incident.service ? `Service: ${incident.service}` : 'Impact: to be completed',
      timeline: incident.timeline,
      rootCause: incident.rootCause ?? 'To be determined',
      failureClass: incident.failureClass,
      actionItems: [
        'Confirm the root cause and add preventive follow-ups.',
        'Verify monitoring/alerting caught (or should have caught) this.',
        'Add or update the relevant runbook.',
        'Confirm recovery was verified.',
      ],
      timeToResolveMinutes: incident.timeToResolveMinutes,
    };
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async require(id: string): Promise<Incident> {
    const incident = await this.store.get(id);
    if (incident === null) {
      throw new OperationsException('OPERATIONS_INCIDENT_NOT_FOUND', `incident ${id} not found`);
    }
    return incident;
  }

  private async apply(
    incident: Incident,
    patch: Partial<Incident>,
    timelineEntry: IncidentTimelineEntry,
  ): Promise<Incident> {
    const updated: Incident = {
      ...incident,
      ...patch,
      timeline: [...incident.timeline, timelineEntry],
    };
    await this.store.save(updated);
    return updated;
  }

  private async record(
    action: string,
    incident: Incident,
    actor: IncidentActor,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.audit.record({
        actorId: actor.id,
        actorRole: actor.role,
        action,
        targetType: 'operations_incident',
        targetId: incident.id,
        metadata: { title: incident.title, status: incident.status, ...metadata },
      });
    } catch (error) {
      this.logger.warn(`incident audit failed (${action}): ${(error as Error).message}`);
    }
  }
}

/** Build a timeline entry (single construction point). */
function entry(type: string, message: string, actor: IncidentActor): IncidentTimelineEntry {
  return { at: nowIso(), type, message, actorId: actor.id ?? 'system' };
}

/** Whole minutes between two ISO instants (feeds MTTR). */
function minutesBetween(fromIso: string, toIso: string): number {
  return Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000));
}
