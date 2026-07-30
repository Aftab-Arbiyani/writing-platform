import type { PieceStatus } from '@qalam/shared';
import { useInfiniteQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { profilePiecesApi } from '../api/profile-pieces.api';

/**
 * The signed-in writer's OWN pieces by status, for the Recent Pieces + Draft Summary sections of
 * their profile (`GET /me/pieces?status=`). Reuses `qk.me.pieces(status)` — the same cache the
 * writer dashboard fills. `enabled` gated to the own profile only (no per-author endpoint exists
 * for other writers, docs/11 §10.4).
 */
export function useMyProfilePieces(status: PieceStatus, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: qk.me.pieces(status),
    queryFn: ({ pageParam, signal }) => profilePiecesApi.listMine(status, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    enabled,
    staleTime: 60_000,
  });
}
