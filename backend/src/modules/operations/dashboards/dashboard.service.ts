import { Injectable } from '@nestjs/common';

/**
 * Operational Dashboard Service (P7.4) — declares the dashboard CATALOGUE (the 15
 * operational views the platform ships) and maps each to the read endpoints that
 * feed it. It is intentionally a thin index: every dashboard is built from the
 * OTHER services' read models (observability, SLO, alerting, incidents, cost,
 * deployment, health) — the dashboard service composes references, it never
 * re-measures. The admin app renders these catalogue entries into its pages.
 */
export interface DashboardDescriptor {
  readonly id: string;
  readonly title: string;
  /** What the dashboard shows. */
  readonly summary: string;
  /** The admin API read endpoint(s) that feed it (all under /admin/operations). */
  readonly sources: readonly string[];
}

const DASHBOARDS: readonly DashboardDescriptor[] = [
  {
    id: 'system-overview',
    title: 'System overview',
    summary: 'Overall platform health, SLO tally, firing alerts, open incidents, cost.',
    sources: ['summary', 'health', 'slo', 'alerts', 'incidents'],
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure',
    summary: 'Process/runtime resources, capacity forecasts, dependency reachability.',
    sources: ['health', 'metrics'],
  },
  {
    id: 'application',
    title: 'Application',
    summary: 'API latency/throughput/error-rate and slowest operations.',
    sources: ['metrics', 'slo'],
  },
  {
    id: 'database',
    title: 'Database',
    summary: 'Slow queries, pool utilization.',
    sources: ['metrics', 'health'],
  },
  {
    id: 'redis',
    title: 'Redis',
    summary: 'Cache hit ratio, op latency, memory.',
    sources: ['metrics', 'health'],
  },
  {
    id: 'queues',
    title: 'Queues',
    summary: 'Per-queue depth, backlog age, worker health.',
    sources: ['health', 'metrics'],
  },
  {
    id: 'search',
    title: 'Search',
    summary: 'Search latency + FTS health.',
    sources: ['metrics', 'slo'],
  },
  {
    id: 'ai-platform',
    title: 'AI platform',
    summary: 'AI latency, availability, token cost.',
    sources: ['metrics', 'cost', 'slo'],
  },
  {
    id: 'payments',
    title: 'Payments',
    summary: 'Payment latency + success rate.',
    sources: ['metrics', 'slo'],
  },
  {
    id: 'authentication',
    title: 'Authentication',
    summary: 'Auth latency + security counters.',
    sources: ['metrics'],
  },
  {
    id: 'security',
    title: 'Security',
    summary: 'Security event rate, threat signals (P7.2).',
    sources: ['metrics', 'alerts'],
  },
  {
    id: 'performance',
    title: 'Performance',
    summary: 'Performance budgets + capacity (P7.3).',
    sources: ['metrics', 'slo'],
  },
  {
    id: 'deployments',
    title: 'Deployments',
    summary: 'Releases, rollbacks, migrations, config changes.',
    sources: ['deployments'],
  },
  {
    id: 'costs',
    title: 'Costs',
    summary: 'Estimated cost by category + trend.',
    sources: ['cost'],
  },
  {
    id: 'business-kpis',
    title: 'Business KPIs',
    summary: 'Availability + reliability posture for the business.',
    sources: ['slo', 'reliability'],
  },
];

@Injectable()
export class DashboardService {
  /** The dashboard catalogue (the 15 operational views). */
  list(): readonly DashboardDescriptor[] {
    return DASHBOARDS;
  }

  /** One dashboard descriptor by id (null when absent). */
  get(id: string): DashboardDescriptor | null {
    return DASHBOARDS.find((d) => d.id === id) ?? null;
  }
}
