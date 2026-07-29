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
  discover: '/discover',
  write: '/write',
  drafts: '/me/drafts',
  notifications: '/notifications',
  // Own-profile redirect target (resolves the signed-in user's handle, docs/11 §10) + requests inbox.
  me: '/me',
  followRequests: '/me/follow-requests',
  // Writer analytics (docs/06 §3.10) — the dashboard + per-piece detail.
  stats: '/me/stats',
  // Settings is a nested surface (docs/11 §1): index redirects to /settings/profile.
  settings: '/settings',
  settingsProfile: '/settings/profile',
  settingsAccount: '/settings/account',
  settingsAppearance: '/settings/appearance',
  settingsNotifications: '/settings/notifications',
  // Blocks/mutes + account standing (AF6 W3c) — a settings section, since both are account-scoped.
  settingsBlocks: '/settings/blocks',
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
 * is live as of W1 (docs/45 §4.1) and cold-loads by slug through `GET /pieces/by-slug/:slug`.
 * Slug is preferred; a null slug (an unpublished piece, which only its author can open) falls
 * back to the id, which the same page resolves.
 */
export function piecePath(idOrSlug: string): string {
  return `/p/${encodeURIComponent(idOrSlug)}`;
}

/** A feed URL for a given tab + optional filter params (used by rail chips → filtered feed). */
export function feedPath(params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params).toString();
  return query ? `${ROUTES.feed}?${query}` : ROUTES.feed;
}

/**
 * A `/search` URL (docs/06 §3.6 — all search state in the URL). `q` plus optional params
 * (`type`, `genre`, `lang`, `tag`, `sort`, …). Empty values are dropped so the link stays clean.
 */
export function searchPath(params: Record<string, string | undefined> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${ROUTES.search}?${query}` : ROUTES.search;
}

/** Per-piece analytics detail path (docs/06 §3.10) — the writer's own piece, keyed by UUID. */
export function pieceStatsPath(pieceId: string): string {
  return `/me/stats/pieces/${encodeURIComponent(pieceId)}`;
}

/**
 * Writer profile path (docs/06 §3.5, docs/11 §1.1). Handles are `@username`; the route is
 * registered as a bare `:handle` (React Router cannot match a static-prefix + param in one
 * segment), so we mint the `@` prefix here and strip it in the route loader.
 */
export function profilePath(username: string): string {
  return `/@${encodeURIComponent(username)}`;
}

/**
 * Segments that can never be a username (docs/11 §1.1) — they are real top-level routes and are
 * rejected at registration, so a `:handle` matching one of these is a 404, not a profile.
 */
export const RESERVED_HANDLES: readonly string[] = [
  'feed',
  'search',
  'discover',
  'me',
  'settings',
  'auth',
  'write',
  'p',
  'tag',
  'genre',
];

/**
 * Validate + unwrap an `@handle` route param into a username, or null when it is not a real
 * handle (missing `@`, empty, or a reserved word). The profile route uses this to 404 cleanly
 * instead of firing a doomed `GET /users/:username`.
 */
export function parseHandle(handle: string | undefined): string | null {
  if (!handle || !handle.startsWith('@')) return null;
  const username = handle.slice(1);
  if (username.length === 0 || RESERVED_HANDLES.includes(username)) return null;
  return username;
}
