import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { operationsConfig } from '../../../config/operations.config';
import { SignalCollectorService } from '../collector/signal-collector.service';
import { SLO_DEFINITIONS } from '../operations.constants';
import { evaluateSlo } from './slo.rules';
import type { OperationalSignals, SloReport, SloStatus } from '../operations.types';
import { nowIso, readSignal } from '../operations.util';

/**
 * SLO Management Service (P7.4) — the SSOT for service-level objectives, error
 * budgets, and burn-rate monitoring. It reads each SLI from the resolved
 * {@link OperationalSignals} (the SAME signals the Performance Platform measures
 * — no re-measurement) and runs the pure {@link evaluateSlo} rule over the SLO
 * catalogue. SLIs, SLOs, availability/latency/reliability/success-rate targets,
 * and burn rate all live here; adding an objective is adding a row to
 * `SLO_DEFINITIONS`.
 */
@Injectable()
export class SloService {
  constructor(
    private readonly signals: SignalCollectorService,
    @Inject(operationsConfig.KEY)
    private readonly config: ConfigType<typeof operationsConfig>,
  ) {}

  /** Evaluate every objective against the live signals. */
  async report(): Promise<SloReport> {
    const signals = await this.signals.collect();
    return this.evaluate(signals);
  }

  /** Pure evaluation over an already-collected signal snapshot (test-friendly). */
  evaluate(signals: OperationalSignals): SloReport {
    const objectives = SLO_DEFINITIONS.map((def) =>
      evaluateSlo(def, readSignal(signals, def.metric)),
    );
    return {
      generatedAt: nowIso(),
      windowSeconds: this.config.slo.windowSeconds,
      objectives,
      meeting: objectives.filter((o) => o.status === 'meeting').length,
      atRisk: objectives.filter((o) => o.status === 'at_risk').length,
      breaching: objectives.filter((o) => o.status === 'breaching').length,
    };
  }

  /** Objectives whose burn rate exceeds the fast-burn threshold (alert input). */
  fastBurning(objectives: readonly SloStatus[]): readonly SloStatus[] {
    return objectives.filter(
      (o) => o.burnRate !== null && o.burnRate >= this.config.slo.fastBurnThreshold,
    );
  }
}
