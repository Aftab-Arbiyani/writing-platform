import type { BudgetVerification } from '../performance.types';
import { gradeHealth } from './performance-report.service';

function verification(failed: number): BudgetVerification {
  return {
    generatedAt: '2026-07-21T00:00:00.000Z',
    total: 20,
    passed: 20 - failed,
    failed,
    notMeasured: 0,
    verdicts: [],
  };
}

describe('gradeHealth', () => {
  it('is healthy with no failures', () => {
    expect(gradeHealth(verification(0))).toBe('healthy');
  });

  it('is degraded with 1–2 failures', () => {
    expect(gradeHealth(verification(1))).toBe('degraded');
    expect(gradeHealth(verification(2))).toBe('degraded');
  });

  it('is unhealthy with 3+ failures', () => {
    expect(gradeHealth(verification(3))).toBe('unhealthy');
    expect(gradeHealth(verification(9))).toBe('unhealthy');
  });
});
