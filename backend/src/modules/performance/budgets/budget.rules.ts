/**
 * The centralized performance-budget rule pipeline (P7.3). A budget rule is a
 * PURE, synchronous function: given a budget and its measured value, it returns
 * a verdict. This mirrors the Policy Engine's ordered pure-rule design — the
 * verification logic lives in ONE place, is trivially unit-testable, and adding
 * a comparator is adding a case here, never editing a business service.
 *
 * Business modules NEVER contain "is this within budget?" logic; they emit
 * samples and the platform runs these rules. That is the "no duplicated
 * optimization logic" guarantee, enforced structurally.
 */
import { BUDGET_COMPARATOR, type PerformanceBudget } from '../performance.constants';
import type { BudgetVerdict } from '../performance.types';

/** Evaluate one budget against a measured value (null = no measurement). */
export function evaluateBudget(budget: PerformanceBudget, measured: number | null): BudgetVerdict {
  const base = {
    id: budget.id,
    domain: budget.domain,
    label: budget.label,
    metric: budget.metric,
    target: budget.target,
    comparator: budget.comparator,
    unit: budget.unit,
    measured,
  } as const;

  if (measured === null) {
    return { ...base, status: 'not_measured' };
  }

  const pass =
    budget.comparator === BUDGET_COMPARATOR.AtMost
      ? measured <= budget.target
      : measured >= budget.target;

  return { ...base, status: pass ? 'pass' : 'fail' };
}
