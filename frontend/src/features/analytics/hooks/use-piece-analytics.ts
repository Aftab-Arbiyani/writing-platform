import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';

import { analyticsApi } from '../api/analytics.api';

/**
 * Per-piece performance (`GET /analytics/pieces/:id`, owner-only). 4xx are not retried (a
 * forbidden/not-found piece is deterministic — the query-client already skips retry on 4xx).
 */
export function usePieceAnalytics(id: string) {
  const isAuthed = useAuthStore((s) => s.status === 'authenticated');
  return useQuery({
    queryKey: qk.analytics.piece(id),
    queryFn: ({ signal }) => analyticsApi.piece(id, signal),
    enabled: isAuthed && id.length > 0,
    staleTime: 5 * 60_000,
  });
}

/**
 * The piece meta (`GET /pieces/:id`) paired with its analytics — supplies the title + `updatedAt`
 * ("Last updated") that the analytics payload doesn't carry. Identity tier (1 min).
 */
export function usePieceMeta(id: string) {
  const isAuthed = useAuthStore((s) => s.status === 'authenticated');
  return useQuery({
    queryKey: qk.analytics.pieceMeta(id),
    queryFn: ({ signal }) => analyticsApi.pieceMeta(id, signal),
    enabled: isAuthed && id.length > 0,
    staleTime: 60_000,
  });
}
