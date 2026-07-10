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
} as const;
