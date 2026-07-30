import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type { Redis } from 'ioredis';

import { RedisService } from '../../../redis/redis.service';
import { operationsConfig } from '../../../config/operations.config';
import { SignalCollectorService } from '../collector/signal-collector.service';
import {
  ALERT_RULES,
  ALERT_SEVERITY,
  OPS_REDIS,
  type AlertCategory,
} from '../operations.constants';
import { evaluateAlertRule } from './alert.rules';
import type {
  AlertEvaluation,
  AlertReport,
  MaintenanceWindow,
  OperationalSignals,
} from '../operations.types';
import { nowIso, opsId, readSignal } from '../operations.util';

/**
 * Alerting Service (P7.4) — evaluates the centralized alert-rule catalogue
 * against the live {@link OperationalSignals} (reuse, not re-measure), then
 * applies the stateful concerns the pure rule can't: DEDUPLICATION (a repeat
 * within the dedup window is suppressed), MAINTENANCE-WINDOW suppression,
 * ROUTING (by severity, from the routing table), and ESCALATION (a firing
 * critical alert opens an incident). Alert state + maintenance windows live in
 * the durable Redis DB (AOF) — the migration-free durable-state pattern; no new
 * table.
 *
 * Escalation is wired via the optional {@link IncidentOpener} hook so this
 * service does not depend on the incident module directly (one-way arrow).
 */
export interface IncidentOpener {
  openFromAlert(alert: AlertEvaluation): Promise<void>;
}

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);
  private readonly redis: Redis;
  private opener: IncidentOpener | null = null;

  constructor(
    redisService: RedisService,
    private readonly signals: SignalCollectorService,
    @Inject(operationsConfig.KEY)
    private readonly config: ConfigType<typeof operationsConfig>,
  ) {
    this.redis = redisService.getClient('auth');
  }

  /** Wire the escalation hook (called once by the incident service on init). */
  registerIncidentOpener(opener: IncidentOpener): void {
    this.opener = opener;
  }

  /** Evaluate every rule against the live signals, applying suppression + escalation. */
  async evaluate(): Promise<AlertReport> {
    const signals = await this.signals.collect();
    const windows = await this.activeMaintenanceWindows();
    const evaluations = ALERT_RULES.map((rule) =>
      evaluateAlertRule(rule, readSignal(signals, rule.metric)),
    );

    const processed: AlertEvaluation[] = [];
    for (const evaluation of evaluations) {
      processed.push(await this.applyStateful(evaluation, windows));
    }

    return {
      generatedAt: nowIso(),
      firing: processed.filter((e) => e.firing && !e.suppressed).length,
      suppressed: processed.filter((e) => e.firing && e.suppressed).length,
      evaluations: processed,
    };
  }

  /** Pure evaluation (no suppression / escalation) over a signal snapshot — for tests. */
  evaluateSignals(signals: OperationalSignals): AlertEvaluation[] {
    return ALERT_RULES.map((rule) => evaluateAlertRule(rule, readSignal(signals, rule.metric)));
  }

  // ── Maintenance windows ────────────────────────────────────────────────────

  /** Open a maintenance window that suppresses alerts (optionally by category). */
  async openMaintenanceWindow(input: {
    reason: string;
    categories?: AlertCategory[];
    durationMinutes: number;
  }): Promise<MaintenanceWindow> {
    const now = Date.now();
    const window: MaintenanceWindow = {
      id: opsId(),
      reason: input.reason,
      categories: input.categories ?? [],
      startsAt: new Date(now).toISOString(),
      endsAt: new Date(now + input.durationMinutes * 60_000).toISOString(),
    };
    await this.redis.hset(OPS_REDIS.maintenanceWindows, window.id, JSON.stringify(window));
    return window;
  }

  /** Close a maintenance window early. */
  async closeMaintenanceWindow(id: string): Promise<void> {
    await this.redis.hdel(OPS_REDIS.maintenanceWindows, id);
  }

  /** Active (not-yet-ended) maintenance windows; prunes expired ones. */
  async activeMaintenanceWindows(): Promise<MaintenanceWindow[]> {
    const raw = await this.redis.hgetall(OPS_REDIS.maintenanceWindows);
    const now = Date.now();
    const active: MaintenanceWindow[] = [];
    for (const [id, json] of Object.entries(raw)) {
      try {
        const w = JSON.parse(json) as MaintenanceWindow;
        if (Date.parse(w.endsAt) <= now) {
          await this.redis.hdel(OPS_REDIS.maintenanceWindows, id);
        } else {
          active.push(w);
        }
      } catch {
        await this.redis.hdel(OPS_REDIS.maintenanceWindows, id);
      }
    }
    return active;
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  /** Apply maintenance suppression, dedup, routing, and escalation to one alert. */
  private async applyStateful(
    evaluation: AlertEvaluation,
    windows: readonly MaintenanceWindow[],
  ): Promise<AlertEvaluation> {
    if (!evaluation.firing) {
      return evaluation;
    }

    // Maintenance-window suppression (all categories, or this alert's category).
    const inWindow = windows.find(
      (w) => w.categories.length === 0 || w.categories.includes(evaluation.category),
    );
    if (inWindow !== undefined) {
      return { ...evaluation, suppressed: true, suppressedReason: `maintenance:${inWindow.id}` };
    }

    // Deduplication: suppress a repeat within the dedup window.
    const firstSeen = await this.dedup(evaluation.id);
    if (!firstSeen) {
      return { ...evaluation, suppressed: true, suppressedReason: 'deduplicated' };
    }

    // Escalation: a fresh, firing critical alert opens an incident.
    if (evaluation.severity === ALERT_SEVERITY.Critical && this.opener !== null) {
      try {
        await this.opener.openFromAlert(evaluation);
      } catch (error) {
        this.logger.warn(
          `incident escalation failed for ${evaluation.id}: ${(error as Error).message}`,
        );
      }
    }
    return evaluation;
  }

  /**
   * Returns true only for the FIRST firing within the dedup window; subsequent
   * firings return false (deduplicated). SET NX + EX is the atomic dedup lock.
   */
  private async dedup(alertId: string): Promise<boolean> {
    const key = `${OPS_REDIS.alertStatePrefix}${alertId}`;
    try {
      const result = await this.redis.set(
        key,
        nowIso(),
        'EX',
        this.config.alerting.dedupWindowSeconds,
        'NX',
      );
      if (result === 'OK') {
        await this.redis.sadd(OPS_REDIS.alertIndex, alertId);
        return true;
      }
      return false;
    } catch (error) {
      // If dedup state is unavailable, err toward notifying (never swallow a real alert).
      this.logger.warn(`alert dedup unavailable for ${alertId}: ${(error as Error).message}`);
      return true;
    }
  }
}
