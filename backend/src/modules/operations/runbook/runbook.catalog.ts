/**
 * The runbook catalogue (P7.4) — declarative operational playbooks, the SSOT for
 * "what an operator does when X fires". Each runbook links to the alert rule(s)
 * it resolves (see `ALERT_RULES[].runbookId`), so the alerting surface, the
 * incident timeline, and the admin runbook viewer all reference the same steps.
 * Adding a runbook is adding a row — the Runbook Service just serves this table.
 *
 * Steps reference EXISTING platform levers only (P7.1 config/health, P7.3
 * capacity/scaling, the feature-rollout kill switches, the deployment rollback
 * path) — the platform never invents new remediation, it points at the tools
 * already shipped.
 */
import { ALERT_SEVERITY } from '../operations.constants';
import type { Runbook } from '../operations.types';

export const RUNBOOK_CATALOG: readonly Runbook[] = [
  {
    id: 'runbook.api-error-spike',
    title: 'API 5xx error spike',
    symptom: 'API 5xx error rate is elevated or critical.',
    severity: ALERT_SEVERITY.Critical,
    steps: [
      'Check `/health/deep` and the Operational Health dashboard for a downed dependency.',
      'Open the Tracing viewer, filter errored spans, identify the failing operation/kind.',
      'If a recent deploy correlates, engage the deployment rollback path (Deployment dashboard).',
      'If a feature is implicated, engage its kill switch on the Rollout dashboard.',
      'Open an incident (auto-opened for SEV-worthy alerts) and record findings on the timeline.',
    ],
    linkedAlerts: ['alert.api.error_rate.critical', 'alert.api.error_rate.warning'],
  },
  {
    id: 'runbook.latency-degradation',
    title: 'API latency degradation',
    symptom: 'API latency p95 exceeds its budget.',
    severity: ALERT_SEVERITY.Warning,
    steps: [
      'Check the Performance analysis (slowest operations) and Capacity forecast.',
      'Check event-loop lag + heap on the Metrics dashboard for saturation.',
      'If a resource crossed its scale threshold, apply its documented scale lever (capacity plan).',
      'Check slow queries; if present, follow runbook.slow-queries.',
    ],
    linkedAlerts: ['alert.api.latency.warning'],
  },
  {
    id: 'runbook.event-loop-lag',
    title: 'Event-loop lag high',
    symptom: 'Event-loop lag p95 exceeds 70ms.',
    severity: ALERT_SEVERITY.Warning,
    steps: [
      'Identify CPU-bound work on the request path via the Tracing viewer.',
      'Move heavy work to a BullMQ worker (existing async backbone) if synchronous.',
      'If sustained, scale API instances horizontally (stateless).',
    ],
    linkedAlerts: ['alert.runtime.event_loop.warning'],
  },
  {
    id: 'runbook.memory-pressure',
    title: 'Heap / memory pressure',
    symptom: 'Heap usage is at/over the ceiling.',
    severity: ALERT_SEVERITY.Critical,
    steps: [
      'Check the resource profile trend (heap/RSS/GC) on the Metrics dashboard.',
      'Restart the instance if a leak is suspected (state is externalized; safe).',
      'Raise the container memory limit or add an instance if load-driven.',
    ],
    linkedAlerts: ['alert.runtime.memory.critical'],
  },
  {
    id: 'runbook.capacity-scale',
    title: 'Resource crossed scale threshold',
    symptom: 'A capacity forecast recommends scaling out.',
    severity: ALERT_SEVERITY.Warning,
    steps: [
      'Open the Capacity forecast (Performance/SLO dashboard) for the resource + scale lever.',
      'Apply the documented lever (raise pool/concurrency, add replica, horizontal API scale).',
      'Confirm utilization drops below the scale threshold.',
    ],
    linkedAlerts: ['alert.capacity.scale.warning'],
  },
  {
    id: 'runbook.queue-backlog',
    title: 'Queue backlog age high',
    symptom: 'The oldest waiting job is older than the SLO.',
    severity: ALERT_SEVERITY.Warning,
    steps: [
      'Check per-queue depth + worker count on the Queues dashboard.',
      'Raise `QUEUE_<NAME>_CONCURRENCY` or add worker capacity.',
      'Inspect the DLQ (failed set) for a poisoned job blocking progress.',
    ],
    linkedAlerts: ['alert.queue.backlog.warning'],
  },
  {
    id: 'runbook.slow-queries',
    title: 'Slow queries detected',
    symptom: 'Queries breach the slow-query threshold.',
    severity: ALERT_SEVERITY.Warning,
    steps: [
      'Read the slow-query list in the Performance report (parameter-free SQL).',
      'Confirm the query has an index; add one via a migration if missing.',
      'Check pool utilization; add a read replica (DATABASE_REPLICA_URL) if saturated.',
    ],
    linkedAlerts: ['alert.db.slow_query.warning'],
  },
  {
    id: 'runbook.cache-degradation',
    title: 'Cache hit ratio low',
    symptom: 'Cache hit ratio dropped below target.',
    severity: ALERT_SEVERITY.Warning,
    steps: [
      'Check Redis memory + eviction on the Redis dashboard.',
      'Confirm the cache warmer cron is running; verify TTL tiers.',
      'Raise `maxmemory` or review key namespaces for churn.',
    ],
    linkedAlerts: ['alert.cache.hit_ratio.warning'],
  },
  {
    id: 'runbook.ai-provider-degradation',
    title: 'AI provider degradation',
    symptom: 'AI completion latency is high or failing.',
    severity: ALERT_SEVERITY.Warning,
    steps: [
      'Check the AI dashboard + provider health indicator.',
      'Swap the active provider in the provider registry (config change, no deploy).',
      'If cost-driven throttling, review AI usage caps on the Cost dashboard.',
    ],
    linkedAlerts: ['alert.ai.latency.warning'],
  },
  {
    id: 'runbook.search-degradation',
    title: 'Search degradation',
    symptom: 'Search latency is high.',
    severity: ALERT_SEVERITY.Warning,
    steps: [
      'Check the Search dashboard + FTS health indicator.',
      'Verify the weekly ANALYZE ran; re-run maintenance if stale.',
      'Review result-cache hit ratio for the `search:` namespace.',
    ],
    linkedAlerts: ['alert.search.latency.warning'],
  },
  {
    id: 'runbook.payment-degradation',
    title: 'Payment degradation',
    symptom: 'Payment operations are slow or failing.',
    severity: ALERT_SEVERITY.Warning,
    steps: [
      'Check the Payments dashboard + payment provider health indicator.',
      'Confirm the provider is configured (key-gated port); check provider status.',
      'Open an incident if success rate breaches its SLO.',
    ],
    linkedAlerts: ['alert.payment.latency.warning'],
  },
  {
    id: 'runbook.security-surge',
    title: 'Security event surge',
    symptom: 'Security event rate spiked (auth failures / threat events).',
    severity: ALERT_SEVERITY.Warning,
    steps: [
      'Open the Security dashboard (P7.2) for the event breakdown + threat scores.',
      'Confirm rate limiting + lockouts are engaging (security counters on /metrics).',
      'Escalate to the security runbook if a coordinated attack is suspected.',
    ],
    linkedAlerts: ['alert.security.events.warning'],
  },
  {
    id: 'runbook.cost-spike',
    title: 'Cost spike',
    symptom: 'Estimated daily cost exceeds budget.',
    severity: ALERT_SEVERITY.Warning,
    steps: [
      'Open the Cost dashboard for the category driving the spike.',
      'If AI-driven, review token usage + org caps (Monetization / Entitlement).',
      'If storage/bandwidth, review lifecycle + CDN configuration.',
    ],
    linkedAlerts: ['alert.cost.daily.warning'],
  },
];

/** Fast lookup of a runbook by id. */
export const RUNBOOK_BY_ID: ReadonlyMap<string, Runbook> = new Map(
  RUNBOOK_CATALOG.map((r) => [r.id, r]),
);
