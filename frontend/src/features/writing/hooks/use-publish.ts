import { useMutation, useQueryClient } from '@tanstack/react-query';

import { newIdempotencyKey } from '@/lib/idempotency';
import { qk } from '@/lib/query-keys';

import { piecesApi } from '../api/pieces.api';
import type { UpdatePiecePayload } from '../types/piece.types';

/**
 * Publish + schedule are two-step (docs/06 §3.4): the publish/schedule endpoints take no
 * metadata, so we first PATCH the sheet's fields (genre, tags, visibility, title, …) then call
 * the lifecycle endpoint. Publish carries a per-intent `Idempotency-Key` (docs/32 §8) so a
 * retried request replays rather than double-publishing. `retry: 0` + a disabled button while
 * pending guard double-submits. On `PIECE_INCOMPLETE` (422) the sheet maps `error.details`
 * (missing fields) inline.
 */
export function usePublishPiece() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UpdatePiecePayload }) => {
      await piecesApi.update(id, patch);
      return piecesApi.publish(id, newIdempotencyKey());
    },
    onSuccess: (piece) => {
      queryClient.setQueryData(qk.pieces.detail(piece.id), piece);
      void queryClient.invalidateQueries({ queryKey: qk.me.all });
      void queryClient.invalidateQueries({ queryKey: qk.feed.all });
    },
  });
}

export function useSchedulePiece() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
      scheduledAt,
    }: {
      id: string;
      patch: UpdatePiecePayload;
      scheduledAt: string;
    }) => {
      await piecesApi.update(id, patch);
      return piecesApi.schedule(id, scheduledAt);
    },
    onSuccess: (piece) => {
      queryClient.setQueryData(qk.pieces.detail(piece.id), piece);
      void queryClient.invalidateQueries({ queryKey: qk.me.all });
    },
  });
}
