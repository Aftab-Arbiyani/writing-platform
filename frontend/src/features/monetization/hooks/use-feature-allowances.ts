import { useMemo } from 'react';

import { useAuthStore } from '@/stores/auth.store';

import { normalizeAllowances, type FeatureAllowance } from '../lib/feature-allowances';
import { useMonetizationUsage } from './use-usage';

/**
 * The writer's per-tool allowances (D5) — "12 of 30 today", per tool.
 *
 * Reads `GET /monetization/usage`, the same request the usage dashboard makes, so opening the drawer
 * after visiting billing costs nothing: one cache entry, 30s stale.
 *
 * **Empty is a legitimate answer, and callers must render it as silence.** Monetization ships
 * dark-launchable (`VITE_ENABLE_MONETIZATION`), and with it off nothing meters, so there is no
 * allowance to report and a hint that said "0 of 0" would invent a wall that does not exist.
 */
export function useFeatureAllowances(): {
  allowances: FeatureAllowance[];
  isPending: boolean;
} {
  const authed = useAuthStore((s) => s.status) === 'authenticated';
  const query = useMonetizationUsage();
  const allowances = useMemo(
    () => (authed ? normalizeAllowances(query.data?.quotas) : []),
    [authed, query.data],
  );
  return { allowances, isPending: query.isPending };
}
