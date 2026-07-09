import { ACCEPTED_IMAGE_TYPES } from '@qalam/shared';

/**
 * Client-side cover validation for instant feedback (docs/32 §6). The server re-validates and
 * re-encodes (strips EXIF, ADR §8) and may still return `MEDIA_TYPE_UNSUPPORTED` (415) /
 * `MEDIA_TOO_LARGE` (413) — this is defense-in-depth, not the authority. Returns an
 * `@qalam/shared` error CODE (→ `messageFor`) or null when acceptable.
 */
const COVER_MAX_BYTES = 15 * 1024 * 1024; // raw cap (docs/32 §6)

export function validateCoverImage(
  file: File,
): 'MEDIA_TYPE_UNSUPPORTED' | 'MEDIA_TOO_LARGE' | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'MEDIA_TYPE_UNSUPPORTED';
  }
  if (file.size > COVER_MAX_BYTES) {
    return 'MEDIA_TOO_LARGE';
  }
  return null;
}
