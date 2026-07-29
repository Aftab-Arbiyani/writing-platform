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
 * 2. **Accepting REWRITES the prose** (`qalam-mobile/docs/56` §3b, defect D1). The server replaces
 *    the anchored range with `suggestedText` and marks the suggestion accepted in one transaction;
 *    a stale anchor — the text at `[from, to)` is no longer `originalText` — is `SUGGESTION_CONFLICT`
 *    and writes nothing. This was the opposite until D1 landed: accept used to touch three columns
 *    and leave the piece alone.
 *
 * Fact 2 is why accept invalidates the **piece** caches and not only the suggestions list
 * (defect C-13). The editor hydrates TipTap from `qk.pieces.detail` ONCE (`use-piece.ts`, 60s
 * `staleTime`) and then autosaves the whole document with no stale-write check
 * (`use-draft-autosave.ts`). So a writer who accepts a suggestion and returns to the editor inside
 * that window would seed the editor with the PRE-accept body and the next keystroke would PATCH it
 * back over the applied edit — losing the change the server just made and leaving the suggestion
 * marked accepted. Invalidating here is what forces the refetch that prevents it.
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

  /**
   * Accept also moved the piece body, so every cached view of it is wrong. The whole
   * `qk.pieces` prefix goes: `detail` (the editor's hydration source and the id-keyed
   * read) and `by-slug` (the reader) are two views of the same content, kept under one
   * prefix precisely so a content mutation clears both — see `query-keys.ts`.
   */
  const invalidateAfterApply = async (): Promise<void> => {
    await Promise.all([
      invalidateSuggestions(),
      client.invalidateQueries({ queryKey: qk.pieces.all }),
    ]);
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
    onSuccess: invalidateAfterApply,
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
