import { useMutation, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { piecesApi } from '../api/pieces.api';

interface UploadCoverArgs {
  id: string;
  file: File;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/**
 * Cover upload/replace (docs/32 §6) — XHR-with-progress under the hood. Returns `{ key }`; the
 * caller builds the CDN URL via `mediaUrl()` for an instant preview. Invalidates the piece
 * detail so other surfaces pick up the new cover. (The frozen `v1` surface has no remove-cover
 * endpoint — cover can be replaced but not cleared; docs/32 §6 / §11.)
 */
export function useUploadCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file, onProgress, signal }: UploadCoverArgs) =>
      piecesApi.uploadCover(id, file, { onProgress, signal }),
    onSuccess: (_result, { id }) => {
      void queryClient.invalidateQueries({ queryKey: qk.pieces.detail(id) });
    },
  });
}
