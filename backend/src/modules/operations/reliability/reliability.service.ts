import { Injectable } from '@nestjs/common';

import { IncidentService } from '../incidents/incident.service';
import { INCIDENT_SEVERITY, INCIDENT_STATUS } from '../operations.constants';
import type { Incident, ReliabilityReport } from '../operations.types';
import { clamp, nowIso, round2, round4 } from '../operations.util';

/** Default reliability reporting window (days). */
const WINDOW_DAYS = 30;

/**
 * Reliability Engineering Service (P7.4) — computes availability, MTTR, MTBF,
 * failure classification, and recovery-verification rate over a rolling window,
 * from the resolved incidents the Incident Service owns (single source of truth
 * for failures). It re-measures nothing: incidents ARE the reliability signal.
 * Availability is derived from impacting (SEV1/SEV2) downtime against the window.
 */
@Injectable()
export class ReliabilityService {
  constructor(private readonly incidents: IncidentService) {}

  /** The reliability report over the default window. */
  async report(windowDays = WINDOW_DAYS): Promise<ReliabilityReport> {
    const all = await this.incidents.list();
    const since = Date.now() - windowDays * 86_400_000;
    const inWindow = all.filter((i) => Date.parse(i.createdAt) >= since);
    return this.compute(inWindow, windowDays);
  }

  /** Pure computation over a set of incidents (test-friendly). */
  compute(incidents: readonly Incident[], windowDays: number): ReliabilityReport {
    const resolved = incidents.filter((i) => i.status === INCIDENT_STATUS.Resolved);
    const windowMinutes = windowDays * 24 * 60;

    // Impacting downtime = resolved SEV1/SEV2 time-to-resolve within the window.
    const downtimeMinutes = resolved
      .filter((i) => i.severity === INCIDENT_SEVERITY.Sev1 || i.severity === INCIDENT_SEVERITY.Sev2)
      .reduce((sum, i) => sum + (i.timeToResolveMinutes ?? 0), 0);

    const ttrs = resolved.map((i) => i.timeToResolveMinutes).filter((m): m is number => m !== null);

    const failuresByClass: Record<string, number> = {};
    for (const i of resolved) {
      const cls = i.failureClass ?? 'unknown';
      failuresByClass[cls] = (failuresByClass[cls] ?? 0) + 1;
    }

    const recoveryVerified = resolved.filter((i) => i.recoveryVerified).length;

    return {
      generatedAt: nowIso(),
      windowDays,
      availabilityRatio: round4(clamp(1 - downtimeMinutes / windowMinutes, 0, 1)),
      incidentsTotal: incidents.length,
      incidentsResolved: resolved.length,
      mttrMinutes: ttrs.length === 0 ? null : round2(ttrs.reduce((s, m) => s + m, 0) / ttrs.length),
      mtbfHours:
        incidents.length === 0 ? null : round2((windowDays * 24) / Math.max(1, incidents.length)),
      failuresByClass,
      recoveryVerifiedRate: resolved.length === 0 ? 1 : round4(recoveryVerified / resolved.length),
    };
  }
}
