import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AiConfigResponse, UpdateAiUserOverridesRequest } from '@qalam/api-types';

import { qk } from '@/lib/query-keys';

import { aiApi } from '../api/ai.api';

/** The caller's effective AI config (resolved) + org defaults + personal overrides. */
export function useAiConfig() {
  return useQuery({
    queryKey: qk.ai.config(),
    queryFn: ({ signal }) => aiApi.getConfig(signal),
    staleTime: 60_000,
  });
}

/** `PATCH /ai/config` — update the user's own overrides; primes the config cache. */
export function useUpdateAiConfig() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateAiUserOverridesRequest) => aiApi.updateConfig(payload),
    onSuccess: (config: AiConfigResponse) => {
      client.setQueryData(qk.ai.config(), config);
    },
  });
}
