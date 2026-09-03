import type {
  RecommendationKind,
  SaveSearchRequest,
  SemanticSearchRequest,
} from '@qalam/api-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';

import { retrievalApi } from '../api/retrieval.api';

/** Retrieval reads are ranked, not paginated, and cheap to keep briefly. */
const RETRIEVAL_STALE = 60_000;

/**
 * Whether the reader is signed in. Saved searches are the only retrieval surface that needs this:
 * D5 made search itself public, so gating results on a session would hide the whole feature from
 * exactly the readers a public search exists for.
 */
function useAuthed(): boolean {
  return useAuthStore((s) => s.status) === 'authenticated';
}

/**
 * Search over the library (`POST /ai/search`).
 *
 * **Public since D5.** The route no longer requires a session and the pipeline calls no model — it
 * is a graph + keyword + metadata retriever behind a ranker, and the one part that ever reached a
 * provider (the optional synthesized answer) is gone. So there is no feature flag and no
 * availability hop left to gate on: an anonymous reader searches, and the only thing a session
 * changes is that the graph retriever has something to personalize with.
 *
 * The path stays `/ai/search` deliberately (D5 decision 10 — rename user-facing copy, not wire
 * contracts). A reader never sees it.
 *
 * `retry: false` because the meaningful failures here are terminal for the request; retrying spends
 * the reader's rate-limit budget to be told the same thing three times.
 */
export function useSemanticSearch(payload: SemanticSearchRequest, enabled = true) {
  return useQuery({
    queryKey: qk.retrieval.search(payload as unknown as Record<string, unknown>),
    queryFn: ({ signal }) => retrievalApi.search(payload, signal),
    enabled: enabled && payload.query.trim().length > 1,
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
  return useQuery({
    queryKey: qk.retrieval.suggestions(q, storyId),
    queryFn: ({ signal }) => retrievalApi.suggestions(q, storyId, signal),
    enabled: q.trim().length > 1,
    staleTime: RETRIEVAL_STALE,
    retry: false,
  });
}

/**
 * The caller's saved searches (`GET /ai/search/saved`).
 *
 * Gated on a SESSION, not on a feature: this route is the one part of retrieval that stayed
 * authenticated after D5, because a saved search belongs to somebody. Firing it for an anonymous
 * reader is a guaranteed 401, and a 401 on a public page is not a harmless one — the api layer's
 * `onUnauthorized()` drops the session, which is how an unrelated authenticated read once logged a
 * reader out of the public reader page (48 §3.25, E2E run 2026-09-01).
 */
export function useSavedSearches() {
  const authed = useAuthed();
  return useQuery({
    queryKey: qk.retrieval.saved(),
    queryFn: ({ signal }) => retrievalApi.savedSearches(signal),
    enabled: authed,
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
 * Keyed per kind + seed so discover can render several at once without them colliding.
 *
 * **Authenticated, but no longer flagged (D5).** The route personalizes against the caller's own
 * history, so it needs a session; it does not need a feature gate, because like search it calls no
 * model — the ranker is the whole engine. Callers pass `enabled: authed`; an anonymous surface uses
 * its tag-based fallback instead (see `use-related-pieces.ts`).
 */
export function useRecommendations(args: {
  kind: RecommendationKind;
  storyId?: string;
  pieceId?: string;
  limit?: number;
  enabled?: boolean;
}) {
  const seed = args.storyId ?? args.pieceId;
  return useQuery({
    queryKey: qk.retrieval.recommendations(args.kind, seed),
    queryFn: ({ signal }) =>
      retrievalApi.recommendations(
        { kind: args.kind, storyId: args.storyId, pieceId: args.pieceId, limit: args.limit },
        signal,
      ),
    enabled: args.enabled ?? true,
    staleTime: RETRIEVAL_STALE,
    retry: false,
  });
}
