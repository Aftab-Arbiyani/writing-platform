import { PERMISSIONS } from '@qalam/shared';
import type {
  AiOrgDefaults,
  RetrievalAdminConfig,
  UpdateAiOrgDefaultsRequest,
  UpdateRetrievalAdminConfig,
} from '@qalam/api-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usePermissions } from '@/hooks/use-permissions';
import { qk } from '@/lib/query-keys';

import { aiApi } from '../api/ai.api';

/** Organization AI defaults (admin). Gated on `ai.manage`. */
export function useAiOrgConfig() {
  const { can } = usePermissions();
  return useQuery({
    queryKey: qk.ai.config(),
    queryFn: ({ signal }) => aiApi.getConfig(signal),
    enabled: can(PERMISSIONS.AiManage),
    staleTime: 30_000,
  });
}

/** `PUT /admin/ai/config` — replace org defaults; primes + invalidates the cache. */
export function useUpdateAiOrgConfig() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateAiOrgDefaultsRequest) => aiApi.updateConfig(payload),
    onSuccess: (config: AiOrgDefaults) => {
      client.setQueryData(qk.ai.config(), config);
      void client.invalidateQueries({ queryKey: qk.ai.all });
    },
  });
}

/** Registered AI providers (configured/implemented status + their models). */
export function useAiProviders() {
  const { can } = usePermissions();
  return useQuery({
    queryKey: qk.ai.providers(),
    queryFn: ({ signal }) => aiApi.providers(signal),
    enabled: can(PERMISSIONS.AiManage),
    staleTime: 60_000,
  });
}

/**
 * Retrieval config (AF4 / A3) — the search, ranking and budget knobs behind every AI retrieval
 * request. Gated on `ai.manage`, the same grant the AF1 reads above carry.
 */
export function useRetrievalConfig() {
  const { can } = usePermissions();
  return useQuery({
    queryKey: qk.ai.searchConfig(),
    queryFn: ({ signal }) => aiApi.searchConfig(signal),
    enabled: can(PERMISSIONS.AiManage),
    staleTime: 30_000,
  });
}

/**
 * `PUT /admin/ai/search-config` — a partial patch, merged per key server-side.
 *
 * The response is the full effective config, so it primes the cache directly; the broader
 * `qk.ai.all` invalidation follows the AF1 write above. Analytics is NOT invalidated: it
 * aggregates requests that already happened, and a config change cannot alter the past.
 */
export function useUpdateRetrievalConfig() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateRetrievalAdminConfig) => aiApi.updateSearchConfig(payload),
    onSuccess: (config: RetrievalAdminConfig) => {
      client.setQueryData(qk.ai.searchConfig(), config);
      void client.invalidateQueries({ queryKey: qk.ai.searchConfig() });
    },
  });
}

/**
 * Internal search-quality analytics over a trailing window (AF4 / A3). Never shown to end users.
 *
 * `staleTime` is short because this is an operational read an admin refreshes deliberately, and
 * the figures move with traffic.
 */
export function useSearchAnalytics(windowDays: number) {
  const { can } = usePermissions();
  return useQuery({
    queryKey: qk.ai.searchAnalytics(windowDays),
    queryFn: ({ signal }) => aiApi.searchAnalytics(windowDays, signal),
    enabled: can(PERMISSIONS.AiManage),
    staleTime: 15_000,
  });
}

/** All registered AI models. */
export function useAiModels() {
  const { can } = usePermissions();
  return useQuery({
    queryKey: qk.ai.models(),
    queryFn: ({ signal }) => aiApi.models(signal),
    enabled: can(PERMISSIONS.AiManage),
    staleTime: 60_000,
  });
}
