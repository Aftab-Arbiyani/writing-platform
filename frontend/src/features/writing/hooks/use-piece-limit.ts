import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { piecesApi } from '../api/pieces.api';

/**
 * The author's plan piece allowance (B4, docs/45 §4.9) — `GET /me/pieces/limit`.
 *
 * Server-authoritative, like every other entitlement read: the client shows the number, and the
 * server decides. A short stale time because the count moves whenever the author creates or deletes
 * a piece; every mutation that changes it invalidates `qk.me.all`, which this key sits under.
 */
export function usePieceLimit() {
  return useQuery({
    queryKey: qk.me.pieceLimit(),
    queryFn: ({ signal }) => piecesApi.limit(signal),
    staleTime: 30_000,
  });
}
