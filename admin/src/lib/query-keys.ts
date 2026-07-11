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
    statistics: (id: string) => ['users', 'detail', id, 'statistics'] as const,
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
} as const;
