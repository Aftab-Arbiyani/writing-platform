import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { get, patch } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { SettingsResponse, UpdateSettingsPayload } from '@/types/profile';

/**
 * The reader's own "turn AI off" switch (B5, docs/45 §4.10) — read and write.
 *
 * **Why app-level rather than in `features/settings`.** The switch is rendered by the AI
 * hub (`features/ai`, `/settings/ai`), which is where a writer looks for AI settings, and
 * a feature may never import another feature (docs/26 §4). This is the same move-down
 * `use-ai-availability.ts` already made for the gate read, and for the same reason.
 *
 * It shares `qk.me.settings()` with `features/settings`' own `useSettings`, so the
 * appearance page and this switch read one cache entry and can never disagree about the
 * preference bag.
 *
 * **Turning it off changes what the SERVER does**, not just what this client draws: AI
 * requests answer `AI_DISABLED_BY_USER` and `GET /ai/features` reports everything off.
 * That is why the mutation invalidates `qk.ai.features()` too — every AI affordance on
 * every open surface gates on that response, and they must re-read it rather than keep
 * showing entry points the server would now refuse.
 */
export function useAiPreference() {
  return useQuery({
    queryKey: qk.me.settings(),
    queryFn: ({ signal }) => get<SettingsResponse>('/settings', { signal }),
    staleTime: 60_000,
  });
}

/** `PATCH /settings { aiEnabled }` — save-on-interaction, like the other settings toggles. */
export function useSetAiPreference() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (aiEnabled: boolean) =>
      patch<SettingsResponse>('/settings', { aiEnabled } satisfies UpdateSettingsPayload),
    onSuccess: (settings: SettingsResponse) => {
      client.setQueryData(qk.me.settings(), settings);
      void client.invalidateQueries({ queryKey: qk.me.settings() });
      // The gate read is now stale everywhere — see the note above.
      void client.invalidateQueries({ queryKey: qk.ai.features() });
    },
  });
}
