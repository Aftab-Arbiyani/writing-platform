/**
 * Admin route paths — the single source of truth for links + the router + the nav config. Flat by
 * design (docs/10 §2: an operations console, not a content site). Section routes are placeholders in
 * A1; feature epics fill them in as lazy route groups.
 */
export const ROUTES = {
  login: '/login',
  dashboard: '/dashboard',
  // Content
  pieces: '/pieces',
  prompts: '/prompts',
  cardTemplates: '/card-templates',
  languages: '/languages',
  featured: '/featured',
  // Moderation
  reports: '/reports',
  // Trust & safety (A2) — behind `trust.view`, which a moderator holds, so it sits below the
  // admin floor that `/users` (and its Trust tab) is gated by.
  trust: '/trust',
  // Platform
  analytics: '/analytics',
  auditLogs: '/audit-logs',
  settings: '/settings',
  aiSettings: '/ai-settings',
  // AI retrieval admin (AF4 / A3). Nested under `/ai-settings` because both pages carry the same
  // `ai.manage` grant as the defaults page above and are read as part of the same surface.
  aiSearchConfig: '/ai-settings/search-config',
  aiSearchAnalytics: '/ai-settings/search-analytics',
  // System / Ops (P7.1)
  systemInfo: '/system',
  configHealth: '/system/config',
  infraHealth: '/system/infrastructure',
  // Security / Compliance / Privacy (P7.2)
  security: '/system/security',
  compliance: '/system/compliance',
  privacy: '/system/privacy',
  // Operations (P7.4)
  operations: '/operations',
  incidents: '/operations/incidents',
  alerts: '/operations/alerts',
  tracing: '/operations/tracing',
  metrics: '/operations/metrics',
  logs: '/operations/logs',
  deployments: '/operations/deployments',
  cost: '/operations/cost',
  slo: '/operations/slo',
  serviceStatus: '/operations/status',
  // Monetization (A1) — every route behind `billing.manage`
  billingPlans: '/billing/plans',
  billingEntitlements: '/billing/entitlements',
  billingCoupons: '/billing/coupons',
  billingActions: '/billing/actions',
  billingRevenue: '/billing/revenue',
  billingSubscriptions: '/billing/subscriptions',
  billingUsage: '/billing/usage',
  // Access
  users: '/users',
  moderators: '/moderators',
  roles: '/roles',
  // Utility
  unauthorized: '/401',
  forbidden: '/403',
  offline: '/offline',
  notFound: '/404',
} as const;

export type RouteKey = keyof typeof ROUTES;
