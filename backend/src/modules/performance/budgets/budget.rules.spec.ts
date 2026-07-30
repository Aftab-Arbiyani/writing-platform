import { BUDGET_COMPARATOR, BUDGET_DOMAIN, type PerformanceBudget } from '../performance.constants';
import { evaluateBudget } from './budget.rules';

function budget(overrides: Partial<PerformanceBudget> = {}): PerformanceBudget {
  return {
    id: 'test.budget',
    domain: BUDGET_DOMAIN.Api,
    label: 'Test',
    metric: 'http.p95Ms',
    target: 400,
    unit: 'ms',
    comparator: BUDGET_COMPARATOR.AtMost,
    serverMeasured: true,
    ...overrides,
  };
}

describe('evaluateBudget', () => {
  it('passes an at-most budget at or under target', () => {
    expect(evaluateBudget(budget(), 399).status).toBe('pass');
    expect(evaluateBudget(budget(), 400).status).toBe('pass');
  });

  it('fails an at-most budget over target', () => {
    expect(evaluateBudget(budget(), 401).status).toBe('fail');
  });

  it('passes an at-least budget at or above target', () => {
    const b = budget({ comparator: BUDGET_COMPARATOR.AtLeast, target: 0.8, unit: 'ratio' });
    expect(evaluateBudget(b, 0.8).status).toBe('pass');
    expect(evaluateBudget(b, 0.95).status).toBe('pass');
  });

  it('fails an at-least budget below target', () => {
    const b = budget({ comparator: BUDGET_COMPARATOR.AtLeast, target: 0.8, unit: 'ratio' });
    expect(evaluateBudget(b, 0.5).status).toBe('fail');
  });

  it('is not_measured with no measurement (never a false pass/fail)', () => {
    const verdict = evaluateBudget(budget(), null);
    expect(verdict.status).toBe('not_measured');
    expect(verdict.measured).toBeNull();
  });

  it('carries the budget metadata onto the verdict', () => {
    const verdict = evaluateBudget(budget({ id: 'api.latency.p95' }), 100);
    expect(verdict).toMatchObject({
      id: 'api.latency.p95',
      target: 400,
      unit: 'ms',
      measured: 100,
    });
  });
});
