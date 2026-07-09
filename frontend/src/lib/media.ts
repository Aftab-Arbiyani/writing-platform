import { env } from '@/config/env';

/**
 * Build a full media URL from a storage KEY. API responses return S3 keys
 * (`avatarKey`, `coverImageKey`) — never URLs (docs/32 §6). Centralize the join here;
 * never string-concatenate keys inline. Falls back to the API origin when no CDN is set.
 */
const BASE = (env.VITE_CDN_URL ?? new URL(env.VITE_API_URL).origin).replace(/\/+$/, '');

export function mediaUrl(key: string | null | undefined): string | undefined {
  if (!key) return undefined;
  if (/^https?:\/\//.test(key)) return key; // already absolute
  return `${BASE}/${key.replace(/^\/+/, '')}`;
}
