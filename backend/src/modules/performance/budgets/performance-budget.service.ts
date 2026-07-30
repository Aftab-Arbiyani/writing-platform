import { Injectable } from '@nestjs/common';

import { PERFORMANCE_BUDGETS, type PerformanceBudget } from '../performance.constants';
import { readMetric } from '../performance.util';
import { nowIso } from '../performance.util';
import { evaluateBudget } from './budget.rules';
import type { BudgetVerification, BudgetVerdict, PerformanceAnalysis } from '../performance.types';

/**
 * Performance Budget Service (P7.3) — owns the budget catalogue (the SSOT in
 * {@link PERFORMANCE_BUDGETS}) and verifies a {@link PerformanceAnalysis} against
 * it by running the pure {@link evaluateBudget} rule over every budget. It reads
 * each budget's metric through the single {@link readMetric} mapping, so the
 * only place that knows "which analysis field backs which budget" is one
 * function. No thresholds live in business code.
 */
@Injectable()
export class PerformanceBudgetService {
  /** The full declarative budget catalogue (read-only). */
  budgets(): readonly PerformanceBudget[] {
    return PERFORMANCE_BUDGETS;
  }

  /** Verify live analysis against every budget. */
  verify(analysis: PerformanceAnalysis): BudgetVerification {
    const verdicts: BudgetVerdict[] = PERFORMANCE_BUDGETS.map((budget) => {
      const measured = budget.serverMeasured ? readMetric(analysis, budget.metric) : null;
      return evaluateBudget(budget, measured);
    });
    return summarize(verdicts);
  }

  /**
   * Verify a set of externally-measured values (e.g. a frontend bundle report or
   * a Flutter startup measurement) against the client budgets — the seam by
   * which out-of-band harnesses check the SAME canonical targets. Unknown ids
   * are ignored; unmeasured budgets stay `not_measured`.
   */
  verifyExternal(measurements: Readonly<Record<string, number>>): BudgetVerification {
    const verdicts: BudgetVerdict[] = PERFORMANCE_BUDGETS.map((budget) => {
      const measured = budget.id in measurements ? (measurements[budget.id] ?? null) : null;
      return evaluateBudget(budget, measured);
    });
    return summarize(verdicts);
  }
}

/** Fold verdicts into a verification summary (pass/fail/not-measured counts). */
export function summarize(verdicts: readonly BudgetVerdict[]): BudgetVerification {
  let passed = 0;
  let failed = 0;
  let notMeasured = 0;
  for (const v of verdicts) {
    if (v.status === 'pass') {
      passed += 1;
    } else if (v.status === 'fail') {
      failed += 1;
    } else {
      notMeasured += 1;
    }
  }
  return {
    generatedAt: nowIso(),
    total: verdicts.length,
    passed,
    failed,
    notMeasured,
    verdicts,
  };
}
