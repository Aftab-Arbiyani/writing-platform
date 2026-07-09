import { useMutation, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { UpdateProfilePayload } from '@/types/profile';

import { settingsProfileApi } from '../api/profile.api';

interface UploadArgs {
  file: File;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/**
 * Own-profile writes (docs/12 §2.4 — no optimism; the form/uploaders reflect the server truth).
 * Every write invalidates the identity query (`qk.auth.me`) and any cached profile detail
 * (`qk.profiles.*`, which includes the viewer's own `/@username`) so the header, menu, and public
 * view all refresh. `PATCH /me` also primes the `auth.me` cache from its response for an instant
 * update.
 */
function useProfileInvalidation() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: qk.auth.me() });
    void client.invalidateQueries({ queryKey: qk.profiles.all });
  };
}

export function useUpdateProfile() {
  const client = useQueryClient();
  const invalidate = useProfileInvalidation();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => settingsProfileApi.update(payload),
    onSuccess: (profile) => {
      client.setQueryData(qk.auth.me(), profile);
      invalidate();
    },
  });
}

export function useUploadAvatar() {
  const invalidate = useProfileInvalidation();
  return useMutation({
    mutationFn: ({ file, onProgress, signal }: UploadArgs) =>
      settingsProfileApi.uploadAvatar(file, { onProgress, signal }),
    onSuccess: invalidate,
  });
}

export function useUploadCover() {
  const invalidate = useProfileInvalidation();
  return useMutation({
    mutationFn: ({ file, onProgress, signal }: UploadArgs) =>
      settingsProfileApi.uploadCover(file, { onProgress, signal }),
    onSuccess: invalidate,
  });
}
