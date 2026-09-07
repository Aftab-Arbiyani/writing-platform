import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { monetizationApi } from '../api/monetization.api';
import { isMonetizationEnabled } from '../lib/monetization-enabled';

/**
 * The writer's per-feature allowances (AF5, W4 — reshaped by D5).
 *
 * **30 seconds — the Live tier** (docs/12 §2.2), because unlike a plan or a subscription this number
 * moves while the reader watches: every AI request meters through the `AI_USAGE_METER` hook, so a
 * writer who runs the assistant and then opens this dashboard must see the request they just made.
 */
const USAGE_STALE = 30 * 1000;

export function useMonetizationUsage() {
  return useQuery({
    queryKey: qk.monetization.usage(),
    queryFn: ({ signal }) => monetizationApi.usage(signal),
    enabled: isMonetizationEnabled(),
    staleTime: USAGE_STALE,
  });
}

/*
 * `isUnlimited`, `remainingTokens` and `isExhausted` used to live here, reading token counts
 * off a `UsageWindowResponse`. D5 removed both the shape and the question: an allowance is a
 * count of actions with its own `unlimited`/`remaining` fields, computed server-side, so a
 * client no longer derives "how much is left" from a token cap. `feature-allowances.ts` is
 * where that lives now.
 */
