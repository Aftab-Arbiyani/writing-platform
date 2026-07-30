import { PERMISSIONS } from '@qalam/shared';
import type { AiOrgDefaults, UpdateAiOrgDefaultsRequest } from '@qalam/api-types';
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
