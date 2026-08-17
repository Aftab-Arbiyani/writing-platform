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
  // Platform
  analytics: '/analytics',
  auditLogs: '/audit-logs',
  settings: '/settings',
  aiSettings: '/ai-settings',
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
