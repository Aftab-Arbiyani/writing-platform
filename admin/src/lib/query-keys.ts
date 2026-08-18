/**
 * Central TanStack Query key factory (docs/12 §2.1). Every query/mutation keys off `qk.*` so
 * invalidation is consistent and greppable. Each dashboard widget keys independently → independent
 * caching + parallel fetches.
 */
export const qk = {
  auth: {
    all: ['auth'] as const,
    me: () => ['auth', 'me'] as const, // current admin session (role from JWT claim)
  },
  dashboard: {
    all: ['dashboard'] as const,
    platform: () => ['dashboard', 'platform'] as const, // GET /analytics/platform
    health: () => ['dashboard', 'health'] as const, // GET /health/*
    queues: () => ['dashboard', 'queues'] as const, // GET /admin/queues
    systemNotifications: (limit: number) => ['dashboard', 'system-notifications', limit] as const,
  },
  users: {
    all: ['users'] as const, // invalidate the whole namespace after a mutation
    list: (params: Record<string, unknown>) => ['users', 'list', params] as const, // GET /admin/users
    detail: (id: string) => ['users', 'detail', id] as const, // GET /admin/users/:id
    activity: (id: string) => ['users', 'detail', id, 'activity'] as const,
    audit: (id: string, params: Record<string, unknown>) =>
      ['users', 'detail', id, 'audit', params] as const,
    loginHistory: (id: string) => ['users', 'detail', id, 'login-history'] as const,
  },
  trust: {
    all: ['trust'] as const, // Trust & Safety admin (AF6, A2); mutations invalidate the namespace
    // Both reads are per-account and there is no cross-account trust route, so every key is
    // keyed by user — like `monetization.overrides` above, and for the same reason.
    summary: (userId: string) => ['trust', 'summary', userId] as const, // GET /admin/users/:id/trust
    restrictions: (userId: string) => ['trust', 'restrictions', userId] as const, // GET …/restrictions
    strikes: (userId: string) => ['trust', 'strikes', userId] as const, // GET …/strikes (B9, A2-2)
  },
  moderation: {
    all: ['moderation'] as const, // invalidate the whole namespace after a mutation
    reports: (params: Record<string, unknown>) => ['moderation', 'reports', params] as const,
    report: (id: string) => ['moderation', 'report', id] as const,
    appeals: (params: Record<string, unknown>) => ['moderation', 'appeals', params] as const,
    appeal: (id: string) => ['moderation', 'appeal', id] as const,
    moderators: () => ['moderation', 'moderators'] as const,
    reportStatistics: () => ['moderation', 'report-statistics'] as const,
    reportTrends: (params: Record<string, unknown>) =>
      ['moderation', 'report-trends', params] as const,
    reportTimeline: (id: string) => ['moderation', 'report-timeline', id] as const,
  },
  audit: {
    all: ['audit'] as const,
    list: (params: Record<string, unknown>) => ['audit', 'list', params] as const,
    detail: (id: string) => ['audit', 'detail', id] as const,
    statistics: () => ['audit', 'statistics'] as const,
  },
  settings: {
    all: ['settings'] as const, // invalidate the whole namespace after a mutation
    list: () => ['settings', 'list'] as const, // GET /admin/settings
    featureFlags: () => ['settings', 'feature-flags'] as const, // GET /admin/feature-flags
    maintenance: () => ['settings', 'maintenance'] as const, // GET /admin/maintenance
  },
  ai: {
    all: ['ai'] as const, // AI platform admin (AF1)
    config: () => ['ai', 'config'] as const, // GET /admin/ai/config (org defaults)
    providers: () => ['ai', 'providers'] as const, // GET /admin/ai/providers
    models: () => ['ai', 'models'] as const, // GET /admin/ai/models
  },
  analytics: {
    all: ['analytics'] as const, // platform analytics dashboard (A8 / E12.9)
    overview: (filters: Record<string, unknown>) => ['analytics', 'overview', filters] as const,
    users: (filters: Record<string, unknown>) => ['analytics', 'users', filters] as const,
    content: (filters: Record<string, unknown>) => ['analytics', 'content', filters] as const,
    engagement: (filters: Record<string, unknown>) => ['analytics', 'engagement', filters] as const,
    moderation: (filters: Record<string, unknown>) => ['analytics', 'moderation', filters] as const,
    system: () => ['analytics', 'system'] as const,
    trending: () => ['analytics', 'trending'] as const,
    moderationTrends: () => ['analytics', 'moderation-trends'] as const,
  },
  system: {
    all: ['system'] as const, // System / Ops views (P7.1)
    info: () => ['system', 'info'] as const, // GET /admin/system/info
    configHealth: () => ['system', 'config-health'] as const, // GET /admin/system/config-health
    deepHealth: () => ['system', 'deep-health'] as const, // GET /health/deep (root probe)
    cache: () => ['system', 'cache'] as const, // GET /admin/cache
    version: () => ['system', 'version'] as const, // GET /version (root probe)
  },
  security: {
    all: ['security'] as const, // Security / Threat dashboard (P7.2)
    status: () => ['security', 'status'] as const, // GET /admin/security/status
    keys: () => ['security', 'keys'] as const, // GET /admin/security/keys
  },
  compliance: {
    all: ['compliance'] as const, // Compliance + Privacy dashboards (P7.2)
    report: () => ['compliance', 'report'] as const, // GET /admin/compliance/report
    retention: () => ['compliance', 'retention'] as const, // GET /admin/compliance/retention
  },
  operations: {
    all: ['operations'] as const, // Operations console (P7.4); mutations invalidate the namespace
    summary: () => ['operations', 'summary'] as const, // GET /admin/operations/summary
    health: () => ['operations', 'health'] as const, // GET /admin/operations/health
    governance: () => ['operations', 'governance'] as const, // GET /admin/operations/governance
    observability: () => ['operations', 'observability'] as const, // GET /admin/operations/observability
    metrics: () => ['operations', 'metrics'] as const, // GET /admin/operations/metrics
    traces: () => ['operations', 'traces'] as const, // GET /admin/operations/traces
    trace: (id: string) => ['operations', 'trace', id] as const, // GET /admin/operations/traces/:id
    slo: () => ['operations', 'slo'] as const, // GET /admin/operations/slo
    alerts: () => ['operations', 'alerts'] as const, // GET /admin/operations/alerts
    cost: () => ['operations', 'cost'] as const, // GET /admin/operations/cost
    reliability: () => ['operations', 'reliability'] as const, // GET /admin/operations/reliability
    deployments: () => ['operations', 'deployments'] as const, // GET /admin/operations/deployments
    incidents: () => ['operations', 'incidents'] as const, // GET /admin/operations/incidents
    incident: (id: string) => ['operations', 'incident', id] as const, // GET …/incidents/:id
    incidentPostmortem: (id: string) => ['operations', 'incident', id, 'postmortem'] as const, // GET …/incidents/:id/postmortem
    rollouts: () => ['operations', 'rollouts'] as const, // GET /admin/operations/rollouts
    runbooks: () => ['operations', 'runbooks'] as const, // GET /admin/operations/runbooks
    maintenanceWindows: () => ['operations', 'maintenance-windows'] as const, // GET …/maintenance-windows
  },
  monetization: {
    all: ['monetization'] as const, // Monetization admin (A1); mutations invalidate the namespace
    plans: () => ['monetization', 'plans'] as const, // GET /admin/monetization/plans
    config: () => ['monetization', 'config'] as const, // GET /admin/monetization/config
    // Keyed by user because there is no "all overrides" route — the read is per-account.
    overrides: (userId: string) => ['monetization', 'overrides', userId] as const, // GET …/overrides/:userId
    coupons: () => ['monetization', 'coupons'] as const, // GET /admin/monetization/coupons
    // The three per-account reads B8 added — each keyed by user, like `overrides` above.
    userSubscription: (userId: string) => ['monetization', 'user-subscription', userId] as const,
    userCredits: (userId: string) => ['monetization', 'user-credits', userId] as const,
    userPayments: (userId: string) => ['monetization', 'user-payments', userId] as const,
    revenue: () => ['monetization', 'revenue'] as const, // GET …/analytics/revenue
    subscriptions: () => ['monetization', 'subscriptions'] as const, // GET …/analytics/subscriptions
    usage: () => ['monetization', 'usage'] as const, // GET …/analytics/usage
  },
} as const;
