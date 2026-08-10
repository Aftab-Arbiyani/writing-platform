import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { conversationApi } from '@/lib/conversation-api';
import { qk } from '@/lib/query-keys';

/**
 * A piece's responses (W7a, docs/45 §4.4) — the pieces written back to it.
 *
 * App-level (docs/26 §4) for the reason the list makes plain: it is READ under the article
 * (`features/reading`) and WRITTEN by creating a draft that opens in the editor
 * (`features/writing`). Neither feature may import the other, so the seam lives here and the
 * reader composes it — the same shape as W1's `useFollow` and W2's AI-editor target.
 */

const RESPONSES_STALE = 20 * 1000;

/**
 * Responses to a piece. `GET /pieces/:id/responses` is `@Public()` + `OptionalAuthGuard`, so this
 * is never gated on the session — a signed-out reader sees the list. (W5-6 gated a public page's
 * read on auth and the 401 cleared the cache for every visitor, docs/48 §3.9.)
 */
export function usePieceResponses(pieceId: string | undefined) {
  return useInfiniteQuery({
    queryKey: qk.conversation.responses(pieceId ?? ''),
    queryFn: ({ pageParam, signal }) => conversationApi.responses(pieceId ?? '', pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    enabled: Boolean(pieceId),
    staleTime: RESPONSES_STALE,
  });
}

/**
 * Write a response: `POST /pieces/:id/responses` creates a linked DRAFT piece and returns it.
 *
 * **This is why there is no inline response composer.** A response is a piece, not a comment — the
 * writer needs the editor, so the flow ends by navigating to the returned draft. Mobile does
 * exactly this (`responses_screen.dart:68-85` → `Routes.writeDraftPath`); the caller performs the
 * navigation, because a hook must not own routing.
 *
 * The new draft is also one of the author's own pieces, so the drafts list is invalidated as well —
 * it is now stale by one row. (It moves B4's piece COUNT too, though not its gate: the cap is
 * enforced on `POST /pieces` only, so a response is never refused for it — `pieces.service.ts`.)
 */
export function useWriteResponse(pieceId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: { languageCode: string; title?: string }) =>
      conversationApi.createResponse(pieceId, input),
    onSuccess: async () => {
      await Promise.all([
        // The response is a DRAFT — it appears in the parent's list only once published, but the
        // list is refreshed anyway so a writer publishing from the editor returns to a true page.
        client.invalidateQueries({ queryKey: qk.conversation.responses(pieceId) }),
        client.invalidateQueries({ queryKey: qk.me.all }),
      ]);
    },
  });
}
