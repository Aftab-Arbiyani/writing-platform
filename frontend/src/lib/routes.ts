/**
 * Central route-path constants (docs/11, ADR §10). Router, guards, and shell nav all
 * reference these — never stringly-typed paths scattered across the app. F1 registers
 * only the shell + placeholder + error routes; feature epics add their own paths here.
 */
export const ROUTES = {
  landing: '/',
  // Authenticated placeholder surfaces (feature epics replace the placeholders):
  feed: '/feed',
  search: '/search',
  write: '/write',
  notifications: '/notifications',
  settings: '/settings',
  // Auth corridor (built in the auth epic — placeholder for redirects now):
  login: '/auth/login',
  // Error surfaces:
  unauthorized: '/401',
  forbidden: '/403',
  offline: '/offline',
  notFound: '/404',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
