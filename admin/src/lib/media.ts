import { env } from '@/config/env';

/**
 * Build a full media URL from a storage KEY. API responses return S3 object keys
 * (`avatarKey`, `coverKey`) — never URLs (docs/32 §6). Centralize the join here;
 * never string-concatenate keys inline. Falls back to the API origin when no CDN is
 * configured (`VITE_CDN_URL` empty). Admin-local copy of the reader's helper — the
 * reader (`frontend/`) is out of scope, mirroring the `lib/jwt.ts` split rationale.
 */
const BASE = (env.VITE_CDN_URL || new URL(env.VITE_API_URL).origin).replace(/\/+$/, '');

export function mediaUrl(key: string | null | undefined): string | undefined {
  if (!key) return undefined;
  if (/^https?:\/\//.test(key)) return key; // already absolute
  return `${BASE}/${key.replace(/^\/+/, '')}`;
}
