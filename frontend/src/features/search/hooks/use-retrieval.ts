import { AiFeature } from '@qalam/shared';
import type {
  RecommendationKind,
  SaveSearchRequest,
  SemanticSearchRequest,
} from '@qalam/api-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAiAvailability } from '@/hooks/use-ai-availability';
import { qk } from '@/lib/query-keys';

import { retrievalApi } from '../api/retrieval.api';

/** AF4 reads are ranked, not paginated, and cheap to keep briefly. */
const RETRIEVAL_STALE = 60_000;

/**
 * Semantic search over the library (`POST /ai/search`).
 *
 * Disabled until the caller actually has a query AND the feature resolves to `available` — a
 * disabled query is what keeps a dark-launched deployment from firing a request per keystroke that
 * can only come back `AI_FEATURE_DISABLED`.
 *
 * `retry: false` because the meaningful failures here are all terminal for the request
 * (`AI_DISABLED`, `AI_FEATURE_DISABLED`, `AI_USAGE_LIMIT_EXCEEDED`, `ENTITLEMENT_DENIED`); retrying
 * spends the reader's rate-limit budget to be told the same thing three times.
 */
export function useSemanticSearch(payload: SemanticSearchRequest, enabled = true) {
  const availability = useAiAvailability(AiFeature.SemanticSearch);
  return useQuery({
    queryKey: qk.retrieval.search(payload as unknown as Record<string, unknown>),
    queryFn: ({ signal }) => retrievalApi.search(payload, signal),
    enabled: enabled && payload.query.trim().length > 1 && availability === 'available',
    staleTime: RETRIEVAL_STALE,
    retry: false,
  });
}

/**
 * Query suggestions (`GET /ai/search/suggestions`).
 *
 * The server takes any prefix of 1+ chars, but this waits for 2 to match `RETRIEVAL_QUERY_MIN_CHARS`
 * — the minimum a *search* accepts — so a suggestion can never be offered for a query the search
 * itself would reject. Caller debounces; this hook does not, because the debounce belongs with the
 * input's keystrokes, not with the cache.
 */
export function useRetrievalSuggestions(q: string, storyId?: string) {
  const availability = useAiAvailability(AiFeature.SemanticSearch);
  return useQuery({
    queryKey: qk.retrieval.suggestions(q, storyId),
    queryFn: ({ signal }) => retrievalApi.suggestions(q, storyId, signal),
    enabled: q.trim().length > 1 && availability === 'available',
    staleTime: RETRIEVAL_STALE,
    retry: false,
  });
}

/** The caller's saved searches (`GET /ai/search/saved`). */
export function useSavedSearches() {
  const availability = useAiAvailability(AiFeature.SemanticSearch);
  return useQuery({
    queryKey: qk.retrieval.saved(),
    queryFn: ({ signal }) => retrievalApi.savedSearches(signal),
    enabled: availability === 'available',
    staleTime: RETRIEVAL_STALE,
  });
}

/**
 * Save a search. Invalidates **only** the saved list — not `qk.retrieval.all`, which would throw
 * away every cached result set and re-run the searches to reflect a change that cannot affect them.
 */
export function useSaveSearch() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveSearchRequest) => retrievalApi.saveSearch(payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.retrieval.saved() });
    },
  });
}

/** Delete a saved search. Same deliberate, single-key invalidation as {@link useSaveSearch}. */
export function useDeleteSavedSearch() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => retrievalApi.deleteSavedSearch(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.retrieval.saved() });
    },
  });
}

/**
 * One recommendation surface (`GET /ai/recommendations`).
 *
 * Keyed per kind + seed so discover can render several at once without them colliding, and gated on
 * the `recommendations` flag, which is independent of search's.
 */
export function useRecommendations(args: {
  kind: RecommendationKind;
  storyId?: string;
  pieceId?: string;
  limit?: number;
  enabled?: boolean;
}) {
  const availability = useAiAvailability(AiFeature.Recommendations);
  const seed = args.storyId ?? args.pieceId;
  return useQuery({
    queryKey: qk.retrieval.recommendations(args.kind, seed),
    queryFn: ({ signal }) =>
      retrievalApi.recommendations(
        { kind: args.kind, storyId: args.storyId, pieceId: args.pieceId, limit: args.limit },
        signal,
      ),
    enabled: (args.enabled ?? true) && availability === 'available',
    staleTime: RETRIEVAL_STALE,
    retry: false,
  });
}
