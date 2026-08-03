import type {
  RecommendationKind,
  RecommendationResponse,
  SaveSearchRequest,
  SavedSearch,
  SearchSuggestionsResponse,
  SemanticSearchRequest,
  SemanticSearchResponse,
} from '@qalam/api-types';

import { del, get, post } from '@/lib/api-client';
import { buildQueryString } from '@/lib/http';

/**
 * Retrieval Platform api layer (AF4 / W5) — the only place the `/ai/*` retrieval endpoints are
 * named on the web. Thin wrappers over the central api-client (auth, envelope, errors and
 * cancellation are all handled there), living in `features/search` because that feature owns both
 * surfaces this row upgrades: `search-page.tsx` and `discover-page.tsx`.
 *
 * **Every one of these requires auth AND the `ai.use` permission**, plus its own AF1 feature flag
 * (`feature.ai.semanticSearch` / `feature.ai.recommendations`) — which ship dark. So each caller
 * needs a not-available state, and none of this can serve a signed-out reader. That is exactly why
 * W1 left the reader's "more like this" as a tag search and why it still keeps that fallback.
 *
 * The one shape worth reading twice is the search filter set: `language`/`genre`/`tags` are FLAT
 * fields and `tags` is a **comma-separated string**, because that is what `SemanticSearchDto`
 * accepts. `@qalam/api-types` used to declare a nested `filters` object, which the global
 * `forbidNonWhitelisted` pipe rejects outright — corrected before this client was written
 * (48 §3.9, W5-1).
 */
export const retrievalApi = {
  /**
   * POST /ai/search — ranked, grounded, explainable results.
   *
   * `synthesize: true` additionally spends an LLM call to produce `answer`; it is opt-in per
   * request because it is the only part of search that costs tokens and meters against the
   * reader's AI allowance.
   */
  search: (payload: SemanticSearchRequest, signal?: AbortSignal): Promise<SemanticSearchResponse> =>
    post<SemanticSearchResponse>('/ai/search', payload, { signal }),

  /** GET /ai/search/suggestions — top matching titles for a prefix. No LLM, cheap enough to type into. */
  suggestions: (q: string, storyId?: string, signal?: AbortSignal): Promise<string[]> =>
    get<SearchSuggestionsResponse>(`/ai/search/suggestions${buildQueryString({ q, storyId })}`, {
      signal,
    }).then((res) => res.suggestions),

  /** GET /ai/search/saved — the caller's saved searches, newest first. */
  savedSearches: (signal?: AbortSignal): Promise<SavedSearch[]> =>
    get<SavedSearch[]>('/ai/search/saved', { signal }),

  /**
   * POST /ai/search/saved — idempotent by NAME: saving again under an existing name updates that
   * row rather than creating a second one. The server caps a user at 50
   * (`SAVED_SEARCH_MAX_PER_USER`) and answers `SAVED_SEARCH_LIMIT_EXCEEDED` beyond it.
   */
  saveSearch: (payload: SaveSearchRequest): Promise<SavedSearch> =>
    post<SavedSearch>('/ai/search/saved', payload),

  /** DELETE /ai/search/saved/:id — 204. `SAVED_SEARCH_NOT_FOUND` for someone else's row. */
  deleteSavedSearch: (id: string): Promise<void> =>
    del(`/ai/search/saved/${encodeURIComponent(id)}`),

  /**
   * GET /ai/recommendations — explainable recommendations for one surface.
   *
   * `kind` is required. The library kinds (`trending`, `feed`, `authors`, `genres`,
   * `related_topics`) need no story graph and are what discover uses; the story-scoped kinds need
   * an owned story with an AF3 graph, which no client can produce yet (48 §3.9, W5-4). `collections`
   * answers an empty set by design — the backend has no collections read surface exported.
   */
  recommendations: (
    args: { kind: RecommendationKind; storyId?: string; pieceId?: string; limit?: number },
    signal?: AbortSignal,
  ): Promise<RecommendationResponse> =>
    get<RecommendationResponse>(
      `/ai/recommendations${buildQueryString({
        kind: args.kind,
        storyId: args.storyId,
        pieceId: args.pieceId,
        limit: args.limit,
      })}`,
      { signal },
    ),
};
