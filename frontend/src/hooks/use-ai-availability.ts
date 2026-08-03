import type { AiFeature } from '@qalam/shared';
import type { AiFeaturesResponse, AiUsageResponse } from '@qalam/api-types';
import { useQuery } from '@tanstack/react-query';

import { resolveAvailability, type AiAvailability } from '@/lib/ai-availability';
import { get } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

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
  const features = useQuery({
    queryKey: qk.ai.features(),
    queryFn: ({ signal }) => get<AiFeaturesResponse>('/ai/features', { signal }),
    staleTime: 60_000,
    retry: false,
  });
  const usage = useQuery({
    queryKey: qk.ai.usage(),
    queryFn: ({ signal }) => get<AiUsageResponse>('/ai/usage/me', { signal }),
    staleTime: 30_000,
    // Advisory: the quota read failing must not hold a surface hostage. Its absence resolves to
    // "not exhausted", and a real quota wall still arrives on the request.
    retry: false,
  });
  return resolveAvailability({ feature, features: features.data, usage: usage.data });
}
