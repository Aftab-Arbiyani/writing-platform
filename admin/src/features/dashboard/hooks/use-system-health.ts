import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { healthApi } from '../api/health.api';
import type { SystemHealth } from '../types/dashboard.types';

/**
 * System-health snapshot from the public `/health/*` probes. No permission gate (health is public).
 * Auto-refreshes every 30s so the panel reflects live status; short staleTime keeps it fresh.
 */
export function useSystemHealth(): UseQueryResult<SystemHealth, Error> {
  return useQuery<SystemHealth, Error>({
    queryKey: qk.dashboard.health(),
    queryFn: ({ signal }) => healthApi.check(signal),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
