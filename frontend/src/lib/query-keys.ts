/**
 * Hierarchical query-key factory (docs/12 §2.1). One factory per app; ad-hoc key arrays
 * are banned by review — invalidation targets prefixes, so keys must be constructed here.
 *
 * F1 (foundation) ships only the session key. Each feature epic ADDS its namespace here
 * (feed, pieces, profiles, notifications, …) with the endpoint each key fetches — the full
 * target shape is specified in docs/12 §2.1. Keys stay data-shaped, never screen-shaped.
 */
export const qk = {
  auth: {
    me: () => ['auth', 'me'] as const, // GET /me — "who am I"
  },
} as const;
