import type {
  AnalyticsPeriod,
  CommentStatus,
  DiscoverPieceKind,
  FeedSort,
  NotificationStatus,
  NotificationType,
  PieceStatus,
  SearchSort,
  SearchType,
  SuggestionStatus,
  TrendType,
  WriterKind,
} from '@qalam/shared';

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

/**
 * Search filters that participate in the results query key + the `SearchPiecesQueryDto` /
 * `SearchWritersQueryDto` wire params (E8, docs/05 §5.1). A stable object → a stable key, so
 * results cache per (type, q, filters). Cursors NEVER live here (opaque; TanStack pageParam).
 */
export interface SearchFilters {
  language?: string;
  genre?: string;
  tag?: string;
  sort?: SearchSort;
  minReadingTime?: number;
  maxReadingTime?: number;
  dateFrom?: string;
  dateTo?: string;
}

export const qk = {
  auth: {
    me: () => ['auth', 'me'] as const, // GET /me — "who am I" (own profile; single session source)
  },

  // Writer profiles — keyed by USERNAME (not id; §2.1). Followers/following are infinite.
  profiles: {
    all: ['profiles'] as const,
    detail: (username: string) => ['profiles', username] as const, // GET /users/:username
    // B3 — the same profile under its OTHER lookup key. A distinct key is unavoidable: the id is
    // all a collaboration/retrieval DTO carries, so the username is not known until the response
    // arrives. `useProfileById` seeds `detail(username)` from the result, so the two converge.
    byId: (userId: string) => ['profiles', 'by-id', userId] as const, // GET /users/by-id/:id
    followers: (username: string) => ['profiles', username, 'followers'] as const, // GET …/followers
    following: (username: string) => ['profiles', username, 'following'] as const, // GET …/following
  },

  // Feed — `tab` is the discriminator; the tab maps to an endpoint PATH (§2.1.1). Infinite.
  feed: {
    all: ['feed'] as const,
    list: (tab: FeedTab, filters?: FeedFilters) => ['feed', 'list', tab, filters ?? {}] as const, // GET /feed/{tab}
  },

  // Discover rails + the Discovery screen (E6). Editorial slices + taxonomy source (no /taxonomy API).
  discover: {
    writers: (kind: WriterKind) => ['discover', 'writers', kind] as const, // GET /discover/writers?kind=
    pieces: (kind: DiscoverPieceKind) => ['discover', 'pieces', kind] as const, // GET /discover/pieces?kind=
    trendingPieces: () => ['discover', 'pieces', 'trending'] as const, // GET /feed/trending (discovery row)
    tags: () => ['discover', 'tags'] as const, // GET /discover/tags
    genres: () => ['discover', 'genres'] as const, // GET /discover/genres
    languages: () => ['discover', 'languages'] as const, // GET /discover/languages
  },

  // Search & Discovery (E8, docs/12 §2.1). `q` is the normalized query; results are keyed by
  // (type, q, filters) and paginate infinitely. Autocomplete/global/trending/recent are flat.
  search: {
    all: ['search'] as const,
    global: (q: string) => ['search', 'global', q] as const, // GET /search (grouped preview)
    results: (type: SearchType, q: string, filters?: SearchFilters) =>
      ['search', 'results', type, q, filters ?? {}] as const, // GET /search/{type} (infinite)
    autocomplete: (q: string) => ['search', 'autocomplete', q] as const, // GET /search/autocomplete
    trending: () => ['search', 'trending'] as const, // GET /search/trending
    recent: () => ['search', 'recent'] as const, // GET /search/recent (authenticated)
  },

  // Writer analytics (E10). Self-scoped aggregates + growth series + per-piece detail (docs/12 §2.1).
  analytics: {
    all: ['analytics'] as const,
    dashboard: () => ['analytics', 'dashboard'] as const, // GET /analytics/dashboard
    growth: (period: AnalyticsPeriod, points: number) =>
      ['analytics', 'growth', period, points] as const, // GET /analytics/me/growth
    readers: () => ['analytics', 'readers'] as const, // GET /analytics/readers/me
    /** The viewer's BOUNDED bookmarks count (one page of GET /me/bookmarks) — W7c. */
    bookmarksCount: () => ['analytics', 'bookmarks-count'] as const,
    piece: (id: string) => ['analytics', 'piece', id] as const, // GET /analytics/pieces/:id
    pieceMeta: (id: string) => ['analytics', 'piece-meta', id] as const, // GET /pieces/:id (title/dates)
    myPieces: (status?: PieceStatus) => ['analytics', 'my-pieces', status ?? 'all'] as const, // GET /me/pieces
    trending: (period: AnalyticsPeriod, type?: TrendType) =>
      ['analytics', 'trending', period, type ?? 'all'] as const, // GET /analytics/trending
  },

  // Notifications & activity (E9). The inbox is keyed by its (status, type) filter and paginates
  // infinitely; the unread count is a small polled query; preferences are a single flat query.
  notifications: {
    all: ['notifications'] as const,
    /** Prefix matcher for every inbox variant — optimistic updates target this across filters. */
    lists: () => ['notifications', 'list'] as const,
    list: (status?: NotificationStatus, type?: NotificationType) =>
      ['notifications', 'list', status ?? 'all', type ?? 'all'] as const, // GET /notifications
    unreadCount: () => ['notifications', 'unread-count'] as const, // GET /notifications/unread-count
    preferences: () => ['notifications', 'preferences'] as const, // GET /notification-preferences
  },

  // A single piece (keyed by UUID — §2.1.1). The editor loads the draft through this once.
  pieces: {
    all: ['pieces'] as const,
    detail: (id: string) => ['pieces', 'detail', id] as const, // GET /pieces/:id
    // The reading view's own key (W1, docs/45 §4.1). Slug-keyed rather than id-keyed because
    // that is what the URL carries and what `GET /pieces/by-slug/:slug` is addressed by — a
    // reader arriving cold has no id. Kept under the same `pieces` prefix so a piece mutation
    // invalidates both views at once.
    bySlug: (slug: string) => ['pieces', 'by-slug', slug] as const, // GET /pieces/by-slug/:slug
    engagement: (id: string) => ['pieces', 'engagement', id] as const, // GET /pieces/:id/engagement
    // "More like this" under the reader — a tag-filtered piece search (see reading.api).
    related: (id: string, tag: string) => ['pieces', 'related', id, tag] as const,
  },

  // The author's own pieces/drafts (writer dashboard). Infinite lists per status.
  me: {
    all: ['me'] as const,
    drafts: () => ['me', 'drafts'] as const, // GET /me/drafts
    pieces: (status?: PieceStatus) => ['me', 'pieces', status ?? 'all'] as const, // GET /me/pieces?status=
    pieceLimit: () => ['me', 'pieces', 'limit'] as const, // GET /me/pieces/limit — the B4 plan cap
    followRequests: () => ['me', 'follow-requests'] as const, // GET /me/follow-requests (infinite)
    settings: () => ['me', 'settings'] as const, // GET /settings
  },

  // AI platform (AF1). Reusable data layer for AI features — feature/flag state, the model
  // registry, effective config, usage, and conversations. Streamed tokens are transient UI
  // state (Zustand), never cached here; the settled result is written to the conversation.
  ai: {
    all: ['ai'] as const,
    features: () => ['ai', 'features'] as const, // GET /ai/features
    models: () => ['ai', 'models'] as const, // GET /ai/models
    config: () => ['ai', 'config'] as const, // GET /ai/config
    usage: () => ['ai', 'usage'] as const, // GET /ai/usage/me
    conversations: () => ['ai', 'conversations'] as const, // GET /ai/conversations (infinite)
    conversation: (id: string) => ['ai', 'conversation', id] as const, // GET /ai/conversations/:id
  },

  // Retrieval Platform (AF4, W5 — docs/36). Kept under its own `retrieval` namespace rather than
  // inside `ai`: these are ranked reads over the library, and a flag/usage refetch (`ai.*`) must
  // not dump a page of search results. Deliberately NOT nested under `search` either — the E8
  // keyword surface and the AF4 retrieval surface answer the same question differently and are
  // cached side by side, so one can degrade to the other without evicting it.
  retrieval: {
    all: ['retrieval'] as const,
    // The whole request shape is the key: two searches differing only by a filter are two
    // different result sets, and `synthesize` changes whether an answer is present at all.
    search: (payload: Record<string, unknown>) => ['retrieval', 'search', payload] as const, // POST /ai/search
    suggestions: (q: string, storyId?: string) =>
      ['retrieval', 'suggestions', q, storyId ?? ''] as const, // GET /ai/search/suggestions
    saved: () => ['retrieval', 'saved'] as const, // GET /ai/search/saved
    // One key per surface — discover renders several kinds at once, and each is its own read.
    recommendations: (kind: string, seed?: string) =>
      ['retrieval', 'recommendations', kind, seed ?? ''] as const, // GET /ai/recommendations
    // Story Explorer (W9). One key per story + view, because the server PROJECTS a different node
    // set per view rather than filtering one payload — `relationships` drops unconnected characters
    // and `timeline` arrives pre-sorted, so a single cached graph could not reproduce either.
    explorer: (storyId: string, view: string) => ['retrieval', 'explorer', storyId, view] as const, // GET /ai/explorer/:storyId/:view
  },

  // Collaboration / publishing / trust (AF6, W3 — docs/49). A "story" IS a piece
  // (`storyId === pieceId`), but these keys stay under their own `stories` namespace: they are
  // collaboration facts about a piece, not the piece itself, so invalidating one never dumps the
  // cached content. `capabilities` is the Policy Engine decision map every affordance reflects.
  stories: {
    all: ['stories'] as const,
    /** Prefix matcher for one story's collaboration data — a membership change targets this. */
    detail: (id: string) => ['stories', id] as const,
    capabilities: (id: string) => ['stories', id, 'capabilities'] as const, // GET …/capabilities
    members: (id: string) => ['stories', id, 'members'] as const, // GET …/members
    // B6. Under the `['stories', id]` prefix so every membership/invitation mutation already
    // invalidates it — adding or revoking either one moves the seat count.
    collaboratorLimit: (id: string) => ['stories', id, 'collaborator-limit'] as const,
    invitations: (id: string) => ['stories', id, 'invitations'] as const, // GET …/invitations
    presence: (id: string) => ['stories', id, 'presence'] as const, // GET …/presence
    // W3b. Root comments and suggestions are cursor-paginated and filterable by status, so the
    // status participates in the key — two filters are two caches, not one that fights itself.
    comments: (id: string, status?: CommentStatus) =>
      ['stories', id, 'comments', status ?? 'all'] as const, // GET …/comments
    suggestions: (id: string, status?: SuggestionStatus) =>
      ['stories', id, 'suggestions', status ?? 'all'] as const, // GET …/suggestions
    // W3c. `review` caches a nullable resource: a story with no session answers `data: null`, which
    // is the Draft state and a perfectly good cache entry (docs/49 §5, defect P-4).
    review: (id: string) => ['stories', id, 'review'] as const, // GET …/review
    snapshots: (id: string) => ['stories', id, 'snapshots'] as const, // GET …/snapshots
    history: (id: string) => ['stories', id, 'publication-history'] as const, // GET …/publication-history
  },

  // A comment thread — its own resource (`GET /comments/:id/thread`), not a field on the comment.
  comments: {
    all: ['comments'] as const,
    thread: (commentId: string) => ['comments', commentId, 'thread'] as const,
  },

  // The public conversation on a PIECE (W7a — `modules/engagement`): reader comments and the
  // responses written back to it.
  //
  // Deliberately its own namespace rather than an addition to `comments` above, which belongs to
  // AF6 collaboration — a story's PRIVATE review (`modules/collaboration`). Different module,
  // different entity, different privacy model: a co-author resolving an inline note on a draft and
  // a stranger replying under a published piece must never invalidate each other, and a single
  // `comments` prefix would make them do exactly that.
  //
  // Replies are NOT nested in `CommentResponseDto` — it carries `replyCount` and the children come
  // from `GET /comments/:id/replies`. So a thread is two keys, and `replies` is fetched lazily when
  // a reader expands it; a page of forty comments must not fire forty reply requests.
  conversation: {
    all: ['conversation'] as const,
    /** Prefix for one piece's whole conversation — a comment or response mutation targets this. */
    piece: (pieceId: string) => ['conversation', pieceId] as const,
    comments: (pieceId: string) => ['conversation', pieceId, 'comments'] as const, // GET /pieces/:id/comments
    responses: (pieceId: string) => ['conversation', pieceId, 'responses'] as const, // GET /pieces/:id/responses
    // Keyed by the PARENT comment id, not by the piece: a reply page is addressed by its parent
    // (`GET /comments/:id/replies`) and the piece is not in that URL. Kept under the same
    // `conversation` root so the whole feature evicts as one.
    replies: (commentId: string) => ['conversation', 'replies', commentId] as const,
  },

  // The viewer's own collaboration inbox — outside `stories` because it spans every story.
  invitations: {
    all: ['invitations'] as const,
    mine: () => ['invitations', 'mine'] as const, // GET /me/invitations
  },

  // Trust & safety (AF6 W3c) — the viewer's own standing and their personal block/mute list. Both
  // are account-scoped, not story-scoped, so they sit outside `stories`.
  trust: {
    all: ['trust'] as const,
    me: () => ['trust', 'me'] as const, // GET /me/trust
    blocks: () => ['trust', 'blocks'] as const, // GET /me/blocks
  },

  // Monetization (AF5, W4 — docs/45 §4). Plans are catalogue data (long-lived); the entitlement
  // SNAPSHOT is the one key premium gating reads, and it is the invalidation target of every
  // subscription action. The four history lists are cursor-paginated and infinite.
  //
  // `entitlements()` is deliberately a single flat key rather than one per feature: the server
  // answers the whole snapshot in one read, so per-feature keys would issue N requests for data
  // one already returned. `entitlement(feature)` exists for the single-feature route, which the
  // app uses only where a decision is needed without the snapshot in scope.
  monetization: {
    all: ['monetization'] as const,
    plans: (region?: string) => ['monetization', 'plans', region ?? 'default'] as const, // GET /monetization/plans
    entitlements: () => ['monetization', 'entitlements'] as const, // GET /monetization/entitlements
    entitlement: (feature: string) => ['monetization', 'entitlements', feature] as const, // GET …/entitlements/:feature
    subscription: () => ['monetization', 'subscription'] as const, // GET /monetization/subscription
    subscriptionHistory: () => ['monetization', 'subscription', 'history'] as const, // GET …/subscription/history
    usage: () => ['monetization', 'usage'] as const, // GET /monetization/usage
    credits: () => ['monetization', 'credits'] as const, // GET /monetization/credits
    creditTransactions: () => ['monetization', 'credits', 'transactions'] as const, // GET …/credits/transactions
    invoices: () => ['monetization', 'invoices'] as const, // GET /monetization/invoices
    payments: () => ['monetization', 'payments'] as const, // GET /monetization/payments
    purchases: () => ['monetization', 'purchases'] as const, // GET /monetization/purchases
  },

  // Reading lists / collections (W7b — `modules/engagement`). Owner-only in Phase 1: every route
  // carries `@Permissions(collection.manage)` and reads are scoped to the caller, so there is no
  // "someone else's collections" key to have. `mine` and `pieces` are cursor-paginated.
  //
  // A piece being saved or removed moves `piecesCount` on the collection AND the membership of its
  // piece list, so both mutations invalidate the `detail(id)` prefix that covers the two.
  collections: {
    all: ['collections'] as const,
    mine: () => ['collections', 'mine'] as const, // GET /collections (infinite)
    /** Prefix for one collection — its header and its pieces. */
    detail: (id: string) => ['collections', id] as const, // GET /collections/:id
    pieces: (id: string) => ['collections', id, 'pieces'] as const, // GET /collections/:id/pieces (infinite)
  },

  // Taxonomy catalogues — NO /taxonomy endpoints exist (§2.1.1); sourced from search (browse).
  taxonomy: {
    genres: () => ['taxonomy', 'genres'] as const, // → GET /search/genres (q omitted)
    languages: () => ['taxonomy', 'languages'] as const, // → GET /search/languages (q omitted)
  },
} as const;
