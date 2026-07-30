import { PERMISSIONS } from '@qalam/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { usePermissions } from '@/hooks/use-permissions';
import { qk } from '@/lib/query-keys';

import { systemApi } from '../api/system.api';
import type {
  CacheStatus,
  ConfigHealth,
  DeepHealth,
  SystemInfo,
  VersionInfo,
} from '../types/system.types';

/**
 * Data hooks for the System / Ops views (P7.1). Each query keys off `qk.system.*` and owns its own
 * cache so views load independently. The admin reads are gated on `admin.dashboard` (the server
 * re-checks); the public probes (`/version`, `/health/deep`) need no gate. Health-shaped queries
 * auto-refresh so operators see live status without a manual reload.
 */

/** `GET /admin/system/info` — deployment/build/release/runtime identity. */
export function useSystemInfo(): UseQueryResult<SystemInfo, Error> {
  const { can } = usePermissions();
  return useQuery<SystemInfo, Error>({
    queryKey: qk.system.info(),
    queryFn: ({ signal }) => systemApi.getSystemInfo(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 30_000,
    refetchInterval: 60_000, // keep uptime reasonably fresh
  });
}

/** `GET /admin/system/config-health` — secret presence/validity + issues. */
export function useConfigHealth(): UseQueryResult<ConfigHealth, Error> {
  const { can } = usePermissions();
  return useQuery<ConfigHealth, Error>({
    queryKey: qk.system.configHealth(),
    queryFn: ({ signal }) => systemApi.getConfigHealth(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** `GET /health/deep` — normalized per-dependency health. Public; refreshes on a short cadence. */
export function useDeepHealth(): UseQueryResult<DeepHealth, Error> {
  return useQuery<DeepHealth, Error>({
    queryKey: qk.system.deepHealth(),
    queryFn: ({ signal }) => systemApi.deepHealth(signal),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/** `GET /admin/cache` — cache DB snapshot. */
export function useCache(): UseQueryResult<CacheStatus, Error> {
  const { can } = usePermissions();
  return useQuery<CacheStatus, Error>({
    queryKey: qk.system.cache(),
    queryFn: ({ signal }) => systemApi.getCache(signal),
    enabled: can(PERMISSIONS.AdminDashboard),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** `GET /version` — public build identity (footer + version card). Rarely changes. */
export function useVersion(): UseQueryResult<VersionInfo | null, Error> {
  return useQuery<VersionInfo | null, Error>({
    queryKey: qk.system.version(),
    queryFn: ({ signal }) => systemApi.version(signal),
    staleTime: 5 * 60_000,
  });
}
