/**
 * Central TanStack Query key factory (docs/12 §2.1). Every query/mutation keys off `qk.*` so
 * invalidation is consistent and greppable. Feature epics extend this with their own namespaces
 * (e.g. `qk.users.list(params)`) — the foundation ships only the session key.
 */
export const qk = {
  auth: {
    all: ['auth'] as const,
    me: () => ['auth', 'me'] as const, // current admin session (role from JWT claim)
  },
} as const;
