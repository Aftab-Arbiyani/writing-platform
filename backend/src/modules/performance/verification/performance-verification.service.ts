import { Injectable } from '@nestjs/common';

import { PerformanceAnalysisService } from '../analysis/performance-analysis.service';
import { PerformanceBudgetService } from '../budgets/performance-budget.service';
import type { BudgetVerdict } from '../performance.types';

/** The outcome of a verification pass — deterministic given the same input. */
export interface VerificationOutcome {
  readonly ok: boolean;
  readonly passed: number;
  readonly failed: number;
  readonly notMeasured: number;
  /** Only the failing verdicts, for a concise CI/regression message. */
  readonly violations: readonly BudgetVerdict[];
}

/**
 * Performance Verification Service (P7.3) — the deterministic gate. It runs the
 * live analysis through the budget catalogue and reports a pass/fail outcome
 * plus the exact violations. Deterministic (same samples → same verdict) so it
 * can back a CI regression check and the performance health probe. It does NOT
 * duplicate budget logic — it composes the {@link PerformanceBudgetService}.
 */
@Injectable()
export class PerformanceVerificationService {
  constructor(
    private readonly analysis: PerformanceAnalysisService,
    private readonly budgets: PerformanceBudgetService,
  ) {}

  /** Verify current live telemetry against the server-measured budgets. */
  verify(): VerificationOutcome {
    const verification = this.budgets.verify(this.analysis.analyze());
    const violations = verification.verdicts.filter((v) => v.status === 'fail');
    return {
      ok: violations.length === 0,
      passed: verification.passed,
      failed: verification.failed,
      notMeasured: verification.notMeasured,
      violations,
    };
  }

  /** Verify externally-measured client budgets (frontend/flutter harnesses). */
  verifyExternal(measurements: Readonly<Record<string, number>>): VerificationOutcome {
    const verification = this.budgets.verifyExternal(measurements);
    const violations = verification.verdicts.filter((v) => v.status === 'fail');
    return {
      ok: violations.length === 0,
      passed: verification.passed,
      failed: verification.failed,
      notMeasured: verification.notMeasured,
      violations,
    };
  }
}
