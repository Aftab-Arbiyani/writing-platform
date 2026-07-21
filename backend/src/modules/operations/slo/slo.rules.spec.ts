import { SLI_KIND, SLO_DEFINITIONS, type SloDefinition } from '../operations.constants';
import { evaluateSlo } from './slo.rules';

const availability = SLO_DEFINITIONS.find((s) => s.id === 'slo.api.availability') as SloDefinition;
const latency = SLO_DEFINITIONS.find((s) => s.id === 'slo.api.latency') as SloDefinition;

describe('evaluateSlo', () => {
  it('returns no_data when the SLI is null', () => {
    const status = evaluateSlo(availability, null);
    expect(status.status).toBe('no_data');
    expect(status.errorBudgetRemaining).toBeNull();
    expect(status.burnRate).toBeNull();
  });

  it('meets an availability objective when the SLI is at/above target', () => {
    const status = evaluateSlo(availability, 0.9995);
    expect(status.status).toBe('meeting');
    expect(status.errorBudgetRemaining).not.toBeNull();
    expect(status.burnRate).toBeLessThan(1);
  });

  it('breaches an availability objective when the SLI is below target', () => {
    const status = evaluateSlo(availability, 0.99);
    expect(status.status).toBe('breaching');
    // 1% observed error vs 0.1% allowed → burn rate 10x, budget exhausted.
    expect(status.burnRate).toBeGreaterThan(1);
    expect(status.errorBudgetRemaining).toBe(0);
  });

  it('flags at_risk when meeting but the error budget is nearly consumed', () => {
    // objective 0.999 → allowed error 0.001; observe 0.9992 → error 0.0008 (80% burned).
    const status = evaluateSlo(availability, 0.9992);
    expect(status.status).toBe('at_risk');
    expect(status.errorBudgetRemaining).toBeLessThan(0.25);
  });

  it('meets a latency objective when under target and reports headroom', () => {
    const status = evaluateSlo(latency, 200); // objective 400ms
    expect(status.status).toBe('meeting');
    expect(status.burnRate).toBeCloseTo(0.5, 3);
    expect(status.errorBudgetRemaining).toBeCloseTo(0.5, 3);
  });

  it('breaches a latency objective when over target', () => {
    const status = evaluateSlo(latency, 800);
    expect(status.status).toBe('breaching');
    expect(status.burnRate).toBeGreaterThan(1);
  });

  it('handles a success-rate objective like availability', () => {
    const def: SloDefinition = { ...availability, kind: SLI_KIND.SuccessRate, objective: 0.99 };
    expect(evaluateSlo(def, 0.995).status).toBe('meeting');
    expect(evaluateSlo(def, 0.98).status).toBe('breaching');
  });
});
