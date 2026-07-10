import { PieceStatus } from '@qalam/shared';
import { useInfiniteQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';

import { analyticsApi } from '../api/analytics.api';

/**
 * The writer's own PUBLISHED pieces (`GET /me/pieces?status=published`), cursor-paginated — the
 * source for the dashboard's pieces table + the "latest published" rows. The list carries metadata
 * only (no per-piece metrics live here), so each row links to `/me/stats/pieces/:id` for the full
 * numbers. Auth-gated.
 */
export function useMyPublishedPieces() {
  const isAuthed = useAuthStore((s) => s.status === 'authenticated');
  return useInfiniteQuery({
    queryKey: qk.analytics.myPieces(PieceStatus.Published),
    queryFn: ({ pageParam, signal }) =>
      analyticsApi.myPieces({ status: PieceStatus.Published, cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    enabled: isAuthed,
    staleTime: 60_000,
  });
}
