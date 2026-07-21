/**
 * The centralized SLO evaluation rule (P7.4). A pure, synchronous function:
 * given an objective and its measured SLI, it returns the objective's live
 * position — SLI vs objective, error budget remaining, and burn rate. This
 * mirrors the P7.3 budget rule + the Policy Engine's pure-rule design: the SLO
 * math lives in ONE place, is trivially unit-testable, and business services
 * carry no "are we meeting our SLO?" logic.
 */
import { OPS_COMPARATOR, SLI_KIND, type SloDefinition } from '../operations.constants';
import type { SloStatus } from '../operations.types';
import { clamp, round4 } from '../operations.util';

/** Evaluate one objective against its measured SLI (null = no signal yet). */
export function evaluateSlo(def: SloDefinition, sli: number | null): SloStatus {
  const base = {
    id: def.id,
    service: def.service,
    label: def.label,
    kind: def.kind,
    objective: def.objective,
    unit: def.unit,
    comparator: def.comparator,
  } as const;

  if (sli === null) {
    return { ...base, sli: null, errorBudgetRemaining: null, burnRate: null, status: 'no_data' };
  }

  const met =
    def.comparator === OPS_COMPARATOR.AtLeast ? sli >= def.objective : sli <= def.objective;

  const { errorBudgetRemaining, burnRate } = budget(def, sli);

  const status: SloStatus['status'] = !met
    ? 'breaching'
    : errorBudgetRemaining !== null && errorBudgetRemaining < 0.25
      ? 'at_risk'
      : 'meeting';

  return { ...base, sli, errorBudgetRemaining, burnRate, status };
}

/**
 * Error budget + burn rate. For ratio objectives (availability / success rate)
 * the budget is the allowed failure ratio `1 - objective`; remaining is what is
 * left of it, burn rate the multiple of that budget being consumed. For latency
 * objectives it is expressed as headroom to the target.
 */
function budget(
  def: SloDefinition,
  sli: number,
): { errorBudgetRemaining: number | null; burnRate: number | null } {
  if (def.kind === SLI_KIND.Availability || def.kind === SLI_KIND.SuccessRate) {
    const allowedError = 1 - def.objective;
    if (allowedError <= 0) {
      return { errorBudgetRemaining: sli >= 1 ? 1 : 0, burnRate: sli >= 1 ? 0 : Infinity };
    }
    const observedError = clamp(1 - sli, 0, 1);
    const burnRate = round4(observedError / allowedError);
    const errorBudgetRemaining = round4(clamp(1 - observedError / allowedError, 0, 1));
    return { errorBudgetRemaining, burnRate };
  }
  if (def.kind === SLI_KIND.ErrorRate) {
    // objective is a max error ratio; sli is the observed error ratio.
    if (def.objective <= 0) {
      return { errorBudgetRemaining: sli <= 0 ? 1 : 0, burnRate: sli <= 0 ? 0 : Infinity };
    }
    const burnRate = round4(sli / def.objective);
    return { errorBudgetRemaining: round4(clamp(1 - sli / def.objective, 0, 1)), burnRate };
  }
  // Latency: headroom to the target (not a classic budget, but a useful signal).
  if (def.objective <= 0) {
    return { errorBudgetRemaining: null, burnRate: null };
  }
  const burnRate = round4(sli / def.objective);
  return { errorBudgetRemaining: round4(clamp(1 - sli / def.objective, 0, 1)), burnRate };
}
