import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { piecesApi } from '../api/pieces.api';

/**
 * Loads a single piece by id (docs/12 §5 — the editor hydrates TipTap from this ONCE, then
 * TipTap is authoritative). `refetchOnWindowFocus:false` so returning to the tab never
 * clobbers in-progress edits. Disabled until an id exists (new drafts have none yet).
 */
export function usePiece(id: string | undefined) {
  return useQuery({
    queryKey: qk.pieces.detail(id ?? 'new'),
    queryFn: ({ signal }) => piecesApi.get(id ?? '', signal),
    enabled: Boolean(id),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
