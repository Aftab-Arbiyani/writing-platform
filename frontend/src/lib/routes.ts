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
  drafts: '/me/drafts',
  notifications: '/notifications',
  settings: '/settings',
  // Auth corridor (docs/11 §10):
  login: '/auth/login',
  register: '/auth/register',
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/auth/reset-password',
  verifyEmail: '/auth/verify-email',
  authCallback: '/auth/callback',
  // Error surfaces:
  unauthorized: '/401',
  forbidden: '/403',
  offline: '/offline',
  notFound: '/404',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * Reading-view path for a piece (docs/06 §3.1 — the whole card links here). The reading view
 * itself is a later epic; feed cards link to it now so the destination exists in markup. Slug
 * is preferred; a null slug (rare) falls back to the id (docs/11 §10.4 — no slug→piece cold
 * load yet, but navigation from a list carries the identifier).
 */
export function piecePath(idOrSlug: string): string {
  return `/p/${encodeURIComponent(idOrSlug)}`;
}

/** A feed URL for a given tab + optional filter params (used by rail chips → filtered feed). */
export function feedPath(params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params).toString();
  return query ? `${ROUTES.feed}?${query}` : ROUTES.feed;
}
