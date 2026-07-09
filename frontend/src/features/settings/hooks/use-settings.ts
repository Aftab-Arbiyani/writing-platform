import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { SettingsResponse, UpdateSettingsPayload } from '@/types/profile';

import { settingsApi } from '../api/settings.api';

/**
 * The preference bag (`GET /settings`). Identity tier (1 min). Theme rendering is driven locally
 * by `useThemeStore` (docs/12 §2.4); this query is the cross-device source of the persisted
 * choice + default visibility + notification flags.
 */
export function useSettings() {
  return useQuery({
    queryKey: qk.me.settings(),
    queryFn: ({ signal }) => settingsApi.get(signal),
    staleTime: 60_000,
  });
}

/**
 * `PATCH /settings` — save-on-interaction for toggles/radios (docs/06 §3.8). Primes the cache from
 * the response and invalidates the settings query. Theme is NOT a query concern (local store).
 */
export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSettingsPayload) => settingsApi.update(payload),
    onSuccess: (settings: SettingsResponse) => {
      client.setQueryData(qk.me.settings(), settings);
      void client.invalidateQueries({ queryKey: qk.me.settings() });
    },
  });
}
