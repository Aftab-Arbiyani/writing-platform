/**
 * The centralized alert evaluation rule (P7.4). A pure, synchronous function:
 * given a rule and its measured value, it returns the alert evaluation (firing
 * or not, routed by severity). This mirrors the P7.3 budget rule + the Policy
 * Engine: alert logic lives in ONE place, is trivially unit-testable, and no
 * business service decides "should this alert fire?". Deduplication, suppression,
 * maintenance windows, and escalation are the (stateful) Alerting Service's job;
 * this rule is the pure firing decision.
 */
import { ALERT_ROUTE, OPS_COMPARATOR, type AlertRule } from '../operations.constants';
import type { AlertEvaluation } from '../operations.types';

/**
 * Evaluate one rule against its measured value. The rule's comparator expresses
 * the HEALTHY condition (e.g. `errorRate AtMost 5` = healthy ≤ 5); the alert
 * FIRES when that condition is violated. `null` (no signal) never fires — an
 * unmeasured signal is not an alert (mirrors P7.3 `not_measured`).
 */
export function evaluateAlertRule(rule: AlertRule, measured: number | null): AlertEvaluation {
  const healthy =
    measured === null
      ? true
      : rule.comparator === OPS_COMPARATOR.AtMost
        ? measured <= rule.threshold
        : measured >= rule.threshold;

  return {
    id: rule.id,
    label: rule.label,
    category: rule.category,
    severity: rule.severity,
    metric: rule.metric,
    threshold: rule.threshold,
    unit: rule.unit,
    measured,
    firing: measured !== null && !healthy,
    runbookId: rule.runbookId,
    route: ALERT_ROUTE[rule.severity],
    suppressed: false,
    suppressedReason: null,
  };
}
