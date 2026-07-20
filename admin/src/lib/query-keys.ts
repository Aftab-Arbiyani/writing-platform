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
} as const;
