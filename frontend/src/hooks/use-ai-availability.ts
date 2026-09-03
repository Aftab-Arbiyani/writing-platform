import type { AiFeature } from '@qalam/shared';
import type { AiFeaturesResponse } from '@qalam/api-types';
import { useQuery } from '@tanstack/react-query';

import { resolveAvailability, type AiAvailability } from '@/lib/ai-availability';
import { get } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Whether a writing tool may be used right now — the ONE gate read, app-level.
 *
 * **Why it lives here.** It is read from `features/ai` and from `app/routes/write.tsx`, and a feature
 * may never import another feature (docs/26 §4), so the read sits where every caller may legally
 * reach it. It shares `qk.ai.features()` with `features/ai`'s own hook, so there is one cache entry
 * no matter how many surfaces ask.
 *
 * `staleTime` is generous because flags change when an admin flips one, not per interaction; the
 * authoritative answer for a REQUEST always comes back from the request itself
 * ({@link import('@/lib/ai-availability').availabilityFromErrorCode}).
 *
 * **`feature: null` asks the master-switch-only question** — "is the platform on for me at all?" —
 * with no per-feature flag. A control that fronts several tools, like the editor's toolbar button,
 * must not be hidden by any one tool's flag.
 *
 * **D5 removed the second read.** This hook also fetched `GET /ai/usage/me` to resolve a token-window
 * quota up front; B2 deleted that route, so keeping it would have been a 404 on every editor load —
 * one of the `D5-clients` breakages (48 §3.22a). The allowance is a per-tool count now, reported by
 * `GET /monetization/usage` and rendered as a hint beside the action, so the gate has nothing to ask
 * about it.
 */
export function useAiAvailability(feature: AiFeature | null): AiAvailability {
  const authed = useAuthStore((state) => state.status) === 'authenticated';

  const features = useQuery({
    queryKey: qk.ai.features(),
    queryFn: ({ signal }) => get<AiFeaturesResponse>('/ai/features', { signal }),
    enabled: authed,
    staleTime: 60_000,
    retry: false,
  });

  /**
   * **A signed-out visitor must not ask, and this is a defect the E2E suite caught rather than a
   * precaution.** `/ai/features` is authenticated, so an anonymous read answers 401 — and a 401
   * outside `/auth/*` is a *terminal session failure* to the api client: it attempts one silent
   * refresh (401 again, there is no cookie), then calls the app's unauthorized handler, which ends
   * the session and **clears the entire query cache** (`app/providers.tsx`). On `/p/:slug` that threw
   * away the piece the reader came for and the page sat in its skeleton indefinitely (48 §3.25).
   *
   * D5 removed this hook from every public surface, so the case should now be unreachable — which is
   * exactly why the guard stays. It costs one comparison, and the failure it prevents is silent,
   * remote from its cause, and was invisible to 143 unit-test files.
   *
   * `off` rather than `unknown`: the tools genuinely are not available to a visitor with no session,
   * and `unknown` renders a skeleton waiting for an answer that will never come.
   */
  if (!authed) return 'off';

  return resolveAvailability({ feature, features: features.data });
}
