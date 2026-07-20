/**
 * Rate-limit tiers (ADR §8 / docs 05 §8) — the single source of truth for the
 * sliding-window limits enforced by the backend `RateLimitGuard`. Auth endpoints
 * are deliberately the strictest tier: they are the credential-stuffing surface.
 *
 * `windowSeconds` is the sliding window; `max` is the allowed request count per
 * window per key. `keyBy` documents what the window is scoped to (the guard
 * derives the Redis key from it: authenticated user id, else client IP).
 *
 * Vocabulary only — no enforcement lives here (that is the backend guard, Redis
 * DB 2). Kept in @qalam/shared so backend limits and any future client-side
 * hinting agree on one table.
 */

/** What a rate-limit window is keyed on. */
export type RateLimitKeyBy = 'ip' | 'user' | 'user-or-ip' | 'ip+email';

/** A single sliding-window tier definition. */
export interface RateLimitTier {
  /** Sliding-window size in seconds. */
  readonly windowSeconds: number;
  /** Maximum requests permitted within the window, per resolved key. */
  readonly max: number;
  /** What the window is scoped to. */
  readonly keyBy: RateLimitKeyBy;
}

/**
 * Named tiers. The `auth:*` tiers map to the auth endpoints (docs 05 §8);
 * `write`/`engagement`/`search`/`read` classify the rest of the API. The
 * multi-window auth rows in the doc (e.g. login 5/min AND 20/hour) are modelled
 * as the tighter short window here; the per-hour ceiling is enforced by the
 * `authLoginHourly` tier applied alongside it when the guard lands (Epic 1 t8).
 */
export const RATE_LIMIT_TIERS = {
  // Auth-critical (docs 13 §8): login is dual-window (5/min AND 20/hour).
  authLogin: { windowSeconds: 60, max: 5, keyBy: 'ip+email' },
  authLoginHourly: { windowSeconds: 3600, max: 20, keyBy: 'ip+email' },
  authRegister: { windowSeconds: 3600, max: 3, keyBy: 'ip' },
  // Forgot + reset share one tier (docs 13 §8): 3/hour, keyed IP + account.
  authPasswordReset: { windowSeconds: 3600, max: 3, keyBy: 'ip+email' },
  // Verification email resend — email-sending, treated like password reset.
  authResendVerification: { windowSeconds: 3600, max: 3, keyBy: 'ip+email' },
  // Refresh (docs 13 §8): 30/hour; keyed per IP here (family id isn't known
  // pre-handler; still bounds abuse — the family/jti check is the real control).
  authRefresh: { windowSeconds: 3600, max: 30, keyBy: 'ip' },
  write: { windowSeconds: 60, max: 30, keyBy: 'user' },
  engagement: { windowSeconds: 60, max: 60, keyBy: 'user' },
  // AI generation (AF1) — completions/streams are expensive upstream calls, so
  // the interactive tier is deliberately tight (per authenticated user). The
  // per-user daily/monthly TOKEN caps are a separate accounting concern (the
  // AI usage service), not a sliding window; this bounds request bursts.
  aiCompletion: { windowSeconds: 60, max: 20, keyBy: 'user' },
  search: { windowSeconds: 60, max: 30, keyBy: 'user-or-ip' },
  // Monetization (AF5). Checkout/subscription mutations touch a payment provider and
  // must not be hammered — tighter than the generic write tier, per authenticated user.
  billing: { windowSeconds: 60, max: 15, keyBy: 'user' },
  // Payment-provider webhooks are unauthenticated (no JWT); the provider signature is
  // the real control. This bounds a flood by source IP without blocking legitimate bursts.
  billingWebhook: { windowSeconds: 60, max: 120, keyBy: 'ip' },
  read: { windowSeconds: 60, max: 300, keyBy: 'user-or-ip' },
  // Baseline applied class-level to every controller so no endpoint is ever
  // unlimited (docs 05 §8 "default"). Endpoints that declare a specific tier
  // override it; this is the safety net for reads/writes not otherwise classified.
  apiDefault: { windowSeconds: 60, max: 300, keyBy: 'user-or-ip' },
} as const satisfies Record<string, RateLimitTier>;

/** Name of a defined rate-limit tier. */
export type RateLimitTierName = keyof typeof RATE_LIMIT_TIERS;
