import type { DiscoverPieceKind, FeedSort, PieceStatus, WriterKind } from '@qalam/shared';

/**
 * Hierarchical query-key factory (docs/12 §2.1). One factory per app; ad-hoc key arrays
 * are banned by review — invalidation targets prefixes, so keys must be constructed here.
 * Keys are data-shaped, never screen-shaped. Each feature epic ADDS its namespace here.
 */

/** The four feed surfaces. `tab` maps to an endpoint PATH in the api layer (docs/12 §2.1.1). */
export type FeedTab = 'following' | 'latest' | 'trending' | 'discover';

/** Feed filters that participate in the query key + the `FeedQueryDto` wire params. */
export interface FeedFilters {
  language?: string;
  genre?: string;
  tag?: string;
  sort?: FeedSort;
  minReadingTime?: number;
  maxReadingTime?: number;
}

export const qk = {
  auth: {
    me: () => ['auth', 'me'] as const, // GET /me — "who am I" (own profile; single session source)
  },

  // Writer profiles — keyed by USERNAME (not id; §2.1). Followers/following are infinite.
  profiles: {
    all: ['profiles'] as const,
    detail: (username: string) => ['profiles', username] as const, // GET /users/:username
    followers: (username: string) => ['profiles', username, 'followers'] as const, // GET …/followers
    following: (username: string) => ['profiles', username, 'following'] as const, // GET …/following
  },

  // Feed — `tab` is the discriminator; the tab maps to an endpoint PATH (§2.1.1). Infinite.
  feed: {
    all: ['feed'] as const,
    list: (tab: FeedTab, filters?: FeedFilters) => ['feed', 'list', tab, filters ?? {}] as const, // GET /feed/{tab}
  },

  // Discover rails — the Discover tab's editorial content + taxonomy source (no /taxonomy API).
  discover: {
    writers: (kind: WriterKind) => ['discover', 'writers', kind] as const, // GET /discover/writers?kind=
    pieces: (kind: DiscoverPieceKind) => ['discover', 'pieces', kind] as const, // GET /discover/pieces?kind=
    tags: () => ['discover', 'tags'] as const, // GET /discover/tags
    genres: () => ['discover', 'genres'] as const, // GET /discover/genres
    languages: () => ['discover', 'languages'] as const, // GET /discover/languages
  },

  // A single piece (keyed by UUID — §2.1.1). The editor loads the draft through this once.
  pieces: {
    all: ['pieces'] as const,
    detail: (id: string) => ['pieces', 'detail', id] as const, // GET /pieces/:id
  },

  // The author's own pieces/drafts (writer dashboard). Infinite lists per status.
  me: {
    all: ['me'] as const,
    drafts: () => ['me', 'drafts'] as const, // GET /me/drafts
    pieces: (status?: PieceStatus) => ['me', 'pieces', status ?? 'all'] as const, // GET /me/pieces?status=
    followRequests: () => ['me', 'follow-requests'] as const, // GET /me/follow-requests (infinite)
    settings: () => ['me', 'settings'] as const, // GET /settings
  },

  // Taxonomy catalogues — NO /taxonomy endpoints exist (§2.1.1); sourced from search (browse).
  taxonomy: {
    genres: () => ['taxonomy', 'genres'] as const, // → GET /search/genres (q omitted)
    languages: () => ['taxonomy', 'languages'] as const, // → GET /search/languages (q omitted)
  },
} as const;
