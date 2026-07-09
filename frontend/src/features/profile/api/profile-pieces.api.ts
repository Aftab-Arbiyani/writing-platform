import type { PieceStatus } from '@qalam/shared';

import { getPage, type CursorPage } from '@/lib/api-client';
import { buildQueryString } from '@/lib/http';

import type { ProfilePiece } from '../types/profile.types';

/**
 * The signed-in writer's OWN pieces, for the Recent Pieces + Draft Summary sections of *their*
 * profile. `GET /me/pieces?status=` is the only writer-pieces endpoint in `v1` and it is
 * viewer-scoped, so this works for the own profile only (another writer's list has no endpoint,
 * docs/11 §10.4). Reuses the shared `qk.me.pieces(status)` cache key (same data as the writer
 * dashboard) without importing the writing feature.
 */
export const profilePiecesApi = {
  listMine: (
    status: PieceStatus,
    cursor: string | undefined,
    signal?: AbortSignal,
  ): Promise<CursorPage<ProfilePiece>> =>
    getPage<ProfilePiece>(`/me/pieces${buildQueryString({ status, cursor, limit: 6 })}`, {
      signal,
    }),
};
