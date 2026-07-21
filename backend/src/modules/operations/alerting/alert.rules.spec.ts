import { ALERT_RULES, ALERT_SEVERITY, type AlertRule } from '../operations.constants';
import { evaluateAlertRule } from './alert.rules';

const errorRateCritical = ALERT_RULES.find(
  (r) => r.id === 'alert.api.error_rate.critical',
) as AlertRule;
const cacheHitRatio = ALERT_RULES.find(
  (r) => r.id === 'alert.cache.hit_ratio.warning',
) as AlertRule;

describe('evaluateAlertRule', () => {
  it('does not fire when the signal is null (not measured)', () => {
    const e = evaluateAlertRule(errorRateCritical, null);
    expect(e.firing).toBe(false);
    expect(e.measured).toBeNull();
  });

  it('fires an at-most rule when the measured value exceeds the threshold', () => {
    const e = evaluateAlertRule(errorRateCritical, 7); // threshold 5%
    expect(e.firing).toBe(true);
    expect(e.severity).toBe(ALERT_SEVERITY.Critical);
    expect(e.route).toBe('oncall-primary');
  });

  it('does not fire an at-most rule when within the threshold', () => {
    expect(evaluateAlertRule(errorRateCritical, 3).firing).toBe(false);
  });

  it('fires an at-least rule when the measured value drops below the threshold', () => {
    const e = evaluateAlertRule(cacheHitRatio, 0.5); // threshold ≥ 0.8
    expect(e.firing).toBe(true);
  });

  it('does not fire an at-least rule when at/above the threshold', () => {
    expect(evaluateAlertRule(cacheHitRatio, 0.9).firing).toBe(false);
  });

  it('carries the runbook link + is not suppressed by the pure rule', () => {
    const e = evaluateAlertRule(errorRateCritical, 9);
    expect(e.runbookId).toBe('runbook.api-error-spike');
    expect(e.suppressed).toBe(false);
    expect(e.suppressedReason).toBeNull();
  });
});
