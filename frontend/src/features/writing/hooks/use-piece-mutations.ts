import { useMutation, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { piecesApi } from '../api/pieces.api';
import type { CreatePiecePayload, UpdatePiecePayload } from '../types/piece.types';

/**
 * Piece lifecycle mutations (docs/12 §2.4). Each keeps the piece-detail cache fresh via
 * `setQueryData`; status-changing mutations also invalidate the dashboard lists (`qk.me.all`)
 * and — when visibility to readers changes — the feeds (`qk.feed.all`). Plain autosave updates
 * do NOT invalidate the lists (too frequent); the dashboard refetches on visit (1m stale).
 */

export function useCreatePiece() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePiecePayload) => piecesApi.create(payload),
    onSuccess: (piece) => {
      queryClient.setQueryData(qk.pieces.detail(piece.id), piece);
      void queryClient.invalidateQueries({ queryKey: qk.me.all });
    },
  });
}

export function useUpdatePiece() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdatePiecePayload }) =>
      piecesApi.update(id, patch),
    onSuccess: (piece) => {
      queryClient.setQueryData(qk.pieces.detail(piece.id), piece);
    },
  });
}

export function useDeletePiece() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => piecesApi.remove(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: qk.pieces.detail(id) });
      void queryClient.invalidateQueries({ queryKey: qk.me.all });
    },
  });
}

export function useDuplicatePiece() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => piecesApi.duplicate(id),
    onSuccess: (piece) => {
      queryClient.setQueryData(qk.pieces.detail(piece.id), piece);
      void queryClient.invalidateQueries({ queryKey: qk.me.all });
    },
  });
}

export function useArchivePiece() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => piecesApi.archive(id),
    onSuccess: (piece) => {
      queryClient.setQueryData(qk.pieces.detail(piece.id), piece);
      void queryClient.invalidateQueries({ queryKey: qk.me.all });
      void queryClient.invalidateQueries({ queryKey: qk.feed.all });
    },
  });
}

export function useUnarchivePiece() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => piecesApi.unarchive(id),
    onSuccess: (piece) => {
      queryClient.setQueryData(qk.pieces.detail(piece.id), piece);
      void queryClient.invalidateQueries({ queryKey: qk.me.all });
      void queryClient.invalidateQueries({ queryKey: qk.feed.all });
    },
  });
}

/** Preview returns the piece as a reader would see it (server-canonical, any status). */
export function usePreviewPiece() {
  return useMutation({
    mutationFn: (id: string) => piecesApi.preview(id),
  });
}
