import { get, patch } from '@/lib/api-client';
import type { SettingsResponse, UpdateSettingsPayload } from '@/types/profile';

/**
 * The DB-only preference bag (`GET/PATCH /settings`, docs/32 §10): theme, default piece
 * visibility, and per-type notification flags. Account privacy + compose language live on the
 * profile (`PATCH /me`), NOT here. Theme is ALSO mirrored to `useThemeStore` for instant,
 * pre-paint rendering (docs/12 §2.4, §3).
 */
export const settingsApi = {
  get: (signal?: AbortSignal): Promise<SettingsResponse> =>
    get<SettingsResponse>('/settings', { signal }),

  update: (payload: UpdateSettingsPayload): Promise<SettingsResponse> =>
    patch<SettingsResponse>('/settings', payload),
};
