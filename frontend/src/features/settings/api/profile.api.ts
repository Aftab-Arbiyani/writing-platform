import { patch } from '@/lib/api-client';
import { uploadWithProgress, type UploadOptions } from '@/lib/upload';
import type { MediaKey, ProfileResponse, UpdateProfilePayload } from '@/types/profile';

/**
 * Own-profile WRITE endpoints (docs/32 §10) — the edit surface. `PATCH /me` is a partial update
 * (only the fields sent change; `username` is permanent and never sent). Avatar/cover uploads are
 * `multipart/form-data` under the field name `file`, via the XHR-progress helper (docs/32 §6),
 * and each returns `{ key }` — the client builds the CDN URL via `mediaUrl()`.
 *
 * NOTE (v1 gaps, docs/32 §11): there is no way to CLEAR `websiteUrl` (`@IsUrl` rejects an empty
 * string) and no remove-image endpoint — images can be replaced but not deleted. Handled in the
 * form/hooks; never faked.
 */
export const settingsProfileApi = {
  update: (payload: UpdateProfilePayload): Promise<ProfileResponse> =>
    patch<ProfileResponse>('/me', payload),

  uploadAvatar: (file: File, options?: UploadOptions): Promise<MediaKey> =>
    uploadWithProgress<MediaKey>('/profile/avatar', file, options),

  uploadCover: (file: File, options?: UploadOptions): Promise<MediaKey> =>
    uploadWithProgress<MediaKey>('/profile/cover', file, options),
};
