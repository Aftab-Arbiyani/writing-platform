import type { PieceStatus } from '@qalam/shared';
import { useInfiniteQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { piecesApi } from '../api/pieces.api';

/**
 * The author's own pieces for the writer dashboard, filtered by status (draft / published /
 * scheduled / archived), cursor-paginated. Identity tier (1m staleTime, docs/12 §2.2) — own
 * drafts change at human speed.
 */
export function useMyPieces(status: PieceStatus) {
  return useInfiniteQuery({
    queryKey: qk.me.pieces(status),
    queryFn: ({ pageParam, signal }) => piecesApi.listMine(status, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    staleTime: 60_000,
  });
}
