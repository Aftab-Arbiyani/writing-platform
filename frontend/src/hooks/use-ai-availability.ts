import type { AiFeature } from '@qalam/shared';
import type { AiFeaturesResponse, AiUsageResponse } from '@qalam/api-types';
import { useQuery } from '@tanstack/react-query';

import { resolveAvailability, type AiAvailability } from '@/lib/ai-availability';
import { get } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Whether an AI feature may be used right now — the ONE gate read, app-level (W5).
 *
 * **Why it lives here.** Three features now need it: `features/ai` (the writing assistant),
 * `features/search` (AF4 search + discover shelves), and `features/reading` ("more like this"). A
 * feature may never import another feature (docs/26 §4), so the alternatives were naming
 * `/ai/features` and `/ai/usage/me` in three api layers or putting the read where all three may
 * legally reach it. This is the second.
 *
 * It shares `qk.ai.features()` / `qk.ai.usage()` with `features/ai`'s own hooks, so there is one
 * cache entry per read no matter how many surfaces ask: a reader who opens the assistant and then
 * three piece pages makes one flag request, not four, and every surface gets the same answer.
 *
 * `staleTime` is generous because these change when an admin flips a flag, not per interaction; the
 * authoritative answer for a REQUEST always comes back from the request itself
 * ({@link import('@/lib/ai-availability').availabilityFromErrorCode}).
 */
export function useAiAvailability(feature: AiFeature): AiAvailability {
  // Both reads require a session, and W5 put this hook on PUBLIC pages (`/search`, `/p/:slug`), so
  // whether there is one decides whether they may be made at all — see below.
  const authed = useAuthStore((state) => state.status) === 'authenticated';

  const features = useQuery({
    queryKey: qk.ai.features(),
    queryFn: ({ signal }) => get<AiFeaturesResponse>('/ai/features', { signal }),
    enabled: authed,
    staleTime: 60_000,
    retry: false,
  });
  const usage = useQuery({
    queryKey: qk.ai.usage(),
    queryFn: ({ signal }) => get<AiUsageResponse>('/ai/usage/me', { signal }),
    enabled: authed,
    staleTime: 30_000,
    // Advisory: the quota read failing must not hold a surface hostage. Its absence resolves to
    // "not exhausted", and a real quota wall still arrives on the request.
    retry: false,
  });

  /**
   * **A signed-out visitor must not ask, and this is a defect the E2E suite caught rather than a
   * precaution.** Both routes are authenticated, so an anonymous reader's gate reads answered 401 —
   * and a 401 outside `/auth/*` is a *terminal session failure* to the api client: it attempts one
   * silent refresh (401 again, there is no cookie), then calls the app's unauthorized handler, which
   * ends the session and **clears the entire query cache** (`app/providers.tsx`). On `/p/:slug` that
   * threw away the piece the reader came for — its own read had already succeeded — and the page sat
   * in its skeleton indefinitely. Live evidence: 35 anonymous `/ai/features` 401s, 35 on
   * `/ai/usage/me`, and 26 failed refreshes in one run, with every anonymous reader spec red.
   *
   * `enabled: authed` stops the requests; returning `signed-out` (never `unknown`) stops the surfaces
   * that consume this from waiting for an answer that will never come — `unknown` renders a skeleton.
   */
  if (!authed) return 'signed-out';

  return resolveAvailability({ feature, features: features.data, usage: usage.data });
}
