/**
 * Central route-path constants (docs/11, ADR §10). Router, guards, and shell nav all
 * reference these — never stringly-typed paths scattered across the app. F1 registers
 * only the shell + placeholder + error routes; feature epics add their own paths here.
 */
export const ROUTES = {
  landing: '/',
  // First-run intro (docs/48 §2 row 7). Public and session-less: it runs BEFORE sign-in and
  // hands off to it, which is why it sits outside both guarded trees.
  onboarding: '/onboarding',
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
  // Reading lists (W7b, docs/45 §4.4). Owner-only — `GET /collections` is scoped to the caller —
  // and on the SAME paths mobile uses (`/me/collections`, `/me/collections/:id`), so a link shared
  // between the two clients resolves on both.
  collections: '/me/collections',
  // Writer analytics (docs/06 §3.10) — the dashboard + per-piece detail.
  stats: '/me/stats',
  // Reader analytics (W7c, docs/45 §4.4). A SEPARATE top-level path from `stats`, not a child of
  // it: the two measure different things for different audiences (what you read vs. what your
  // writing reached), and nesting the reader surface under a writer path is the confusion the row
  // exists to fix. Sits beside `collections` — both are the reader's own account-scoped surfaces,
  // both reached from the account menu.
  reading: '/me/reading',
  // Settings is a nested surface (docs/11 §1): index redirects to /settings/profile.
  settings: '/settings',
  settingsProfile: '/settings/profile',
  settingsAccount: '/settings/account',
  settingsAppearance: '/settings/appearance',
  settingsNotifications: '/settings/notifications',
  // Blocks/mutes + account standing (AF6 W3c) — a settings section, since both are account-scoped.
  settingsBlocks: '/settings/blocks',
  // Monetization (AF5 W4). A settings SECTION for the same reason as Safety: a subscription, its
  // usage, its credits and its receipts are all account-scoped. `settingsBilling` is the hub (the
  // web analog of mobile's subscription_screen, its "monetization home"); the other four are
  // reached from it and are not separate nav entries.
  settingsBilling: '/settings/billing',
  settingsBillingPlans: '/settings/billing/plans',
  settingsBillingUsage: '/settings/billing/usage',
  settingsBillingCredits: '/settings/billing/credits',
  settingsBillingHistory: '/settings/billing/history',
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

/**
 * The editor path for an existing draft (`/write/:draftId`).
 *
 * A named helper rather than an inline template because W7a made it a **cross-feature seam**:
 * writing a response creates a linked draft (`POST /pieces/:id/responses`) and the flow ends in the
 * editor — but that flow is composed at app level and the reader is what renders it, so neither may
 * reach into `features/writing` (docs/26 §4). Route composition is the sanctioned way across, and a
 * route is only composable once it has a name.
 */
export function draftPath(draftId: string): string {
  return `${ROUTES.write}/${encodeURIComponent(draftId)}`;
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

/** One collection's detail path (W7b) — keyed by UUID, as `ParseUUIDPipe` on the route requires. */
export function collectionPath(collectionId: string): string {
  return `${ROUTES.collections}/${encodeURIComponent(collectionId)}`;
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
  'onboarding',
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
