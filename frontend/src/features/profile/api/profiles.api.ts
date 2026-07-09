import { get } from '@/lib/api-client';
import type { ProfileResponse } from '@/types/profile';

/**
 * Profile READ endpoints (docs/32 §10). The public profile is keyed by USERNAME
 * (`GET /users/:username`, optional-auth — the server applies the private-account teaser rule for
 * strangers). The signed-in user's OWN profile (`GET /me`) is read via the app-level `useMe`
 * hook, not here, so that identity query stays a single source (docs/12 §2.1). Mutations
 * (`PATCH /me`, uploads) live in the settings feature (the edit surface).
 */
export const profilesApi = {
  getByUsername: (username: string, signal?: AbortSignal): Promise<ProfileResponse> =>
    get<ProfileResponse>(`/users/${encodeURIComponent(username)}`, { signal }),
};
