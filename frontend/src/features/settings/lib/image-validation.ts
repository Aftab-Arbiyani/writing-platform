import { ACCEPTED_IMAGE_TYPES, AVATAR_IMAGE_MAX_MB, COVER_IMAGE_MAX_MB } from '@qalam/shared';

/**
 * Client-side avatar/cover validation for instant feedback (docs/32 §6). Enforces the EFFECTIVE
 * per-kind caps (avatar ≤5 MB, cover ≤10 MB — the numbers the service actually enforces) so an
 * oversized file fails before the upload. The server re-validates + re-encodes to WebP and strips
 * EXIF/GPS, and may still return `MEDIA_TYPE_UNSUPPORTED` (415) / `MEDIA_TOO_LARGE` (413) — this
 * is defense-in-depth, not the authority. Returns an `@qalam/shared` error CODE or null.
 */
export type ImageValidationError = 'MEDIA_TYPE_UNSUPPORTED' | 'MEDIA_TOO_LARGE';

function validate(file: File, maxMb: number): ImageValidationError | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'MEDIA_TYPE_UNSUPPORTED';
  }
  if (file.size > maxMb * 1024 * 1024) {
    return 'MEDIA_TOO_LARGE';
  }
  return null;
}

export function validateAvatarImage(file: File): ImageValidationError | null {
  return validate(file, AVATAR_IMAGE_MAX_MB);
}

export function validateCoverImage(file: File): ImageValidationError | null {
  return validate(file, COVER_IMAGE_MAX_MB);
}
