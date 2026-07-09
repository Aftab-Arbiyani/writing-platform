import type { PieceStatus } from '@qalam/shared';

import { del, get, getPage, patch, post, type CursorPage } from '@/lib/api-client';
import { buildQueryString } from '@/lib/http';
import { uploadWithProgress, type UploadOptions } from '@/lib/upload';

import type {
  CreatePiecePayload,
  Piece,
  PieceListItem,
  UpdatePiecePayload,
} from '../types/piece.types';

/**
 * The writing `api/` layer — the only place piece endpoints are named (docs/32 §10). Publish
 * carries a per-intent `Idempotency-Key` (docs/32 §8). Cover upload uses the XHR-progress
 * helper (docs/32 §6). Lists are cursor-paginated; a single piece unwraps to `data`.
 */
export const piecesApi = {
  create: (payload: CreatePiecePayload) => post<Piece>('/pieces', payload),

  get: (id: string, signal?: AbortSignal) => get<Piece>(`/pieces/${id}`, { signal }),

  update: (id: string, payload: UpdatePiecePayload, signal?: AbortSignal) =>
    patch<Piece>(`/pieces/${id}`, payload, { signal }),

  remove: (id: string) => del(`/pieces/${id}`),

  listMine: (
    status: PieceStatus | undefined,
    cursor: string | undefined,
    signal?: AbortSignal,
  ): Promise<CursorPage<PieceListItem>> =>
    getPage<PieceListItem>(`/me/pieces${buildQueryString({ status, cursor, limit: 20 })}`, {
      signal,
    }),

  publish: (id: string, idempotencyKey: string) =>
    post<Piece>(`/pieces/${id}/publish`, undefined, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),

  schedule: (id: string, scheduledAt: string) =>
    post<Piece>(`/pieces/${id}/schedule`, { scheduledAt }),

  archive: (id: string) => post<Piece>(`/pieces/${id}/archive`),

  unarchive: (id: string) => post<Piece>(`/pieces/${id}/unarchive`),

  duplicate: (id: string) => post<Piece>(`/pieces/${id}/duplicate`),

  preview: (id: string) => post<Piece>(`/pieces/${id}/preview`),

  /** Cover upload/replace → `{ key }`; client builds the CDN URL via `mediaUrl()`. */
  uploadCover: (id: string, file: File, options?: UploadOptions) =>
    uploadWithProgress<{ key: string }>(`/pieces/${id}/cover`, file, options),
};
