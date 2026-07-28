import { ERROR_CODES, type SuggestionStatus } from '@qalam/shared';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { isApiError } from '@/lib/errors';
import { qk } from '@/lib/query-keys';

import { collaborationApi } from '../api/collaboration.api';

/**
 * Story suggestions (AF6, W3b — docs/49 §5): proposed edits, each anchored to a text range.
 *
 * Two contract facts shape this hook, both found by reading the DTOs rather than the mobile client
 * (defect M-2, docs/48 §3.2):
 *
 * 1. **`anchor` is required** on create, alongside `originalText` / `suggestedText`. Mobile omitted
 *    it and sent `blockId`/`rationale` instead, so its create could only ever 400.
 * 2. **Accepting does not rewrite the prose.** The server verifies the anchored `originalText` is
 *    still present — else `SUGGESTION_CONFLICT` — and records the decision. Applying the
 *    replacement is the writer's own edit, so the UI must say so rather than implying it is done.
 */
const SUGGESTIONS_STALE = 20 * 1000;

export function useStorySuggestions(storyId: string | undefined, status?: SuggestionStatus) {
  return useInfiniteQuery({
    queryKey: qk.stories.suggestions(storyId ?? '', status),
    queryFn: ({ pageParam, signal }) =>
      collaborationApi.suggestions(storyId ?? '', { cursor: pageParam, status }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    enabled: Boolean(storyId),
    staleTime: SUGGESTIONS_STALE,
  });
}

/** True when a failed accept was refused because the anchored text has since changed. */
export function isSuggestionConflict(error: unknown): boolean {
  return isApiError(error) && error.code === ERROR_CODES.SUGGESTION_CONFLICT;
}

export function useSuggestionActions(storyId: string) {
  const client = useQueryClient();

  const invalidateSuggestions = async (): Promise<void> => {
    await client.invalidateQueries({ queryKey: ['stories', storyId, 'suggestions'] });
  };

  const addSuggestion = useMutation({
    mutationFn: (input: {
      anchor: { from: number; to: number };
      originalText: string;
      suggestedText: string;
    }) => collaborationApi.addSuggestion(storyId, input),
    onSuccess: invalidateSuggestions,
  });

  /**
   * Not optimistic. A conflict is a real and expected outcome — the prose moved under the
   * suggestion — so flipping the row to "accepted" and then rolling it back would tell the writer
   * the opposite of what happened, twice.
   */
  const acceptSuggestion = useMutation({
    mutationFn: (suggestionId: string) => collaborationApi.acceptSuggestion(suggestionId),
    onSuccess: invalidateSuggestions,
  });

  const rejectSuggestion = useMutation({
    mutationFn: (suggestionId: string) => collaborationApi.rejectSuggestion(suggestionId),
    onSuccess: invalidateSuggestions,
  });

  const withdrawSuggestion = useMutation({
    mutationFn: (suggestionId: string) => collaborationApi.withdrawSuggestion(suggestionId),
    onSuccess: invalidateSuggestions,
  });

  return { addSuggestion, acceptSuggestion, rejectSuggestion, withdrawSuggestion };
}
