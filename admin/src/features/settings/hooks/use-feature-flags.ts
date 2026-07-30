import { PERMISSIONS } from '@qalam/shared';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { usePermissions } from '@/hooks/use-permissions';
import { qk } from '@/lib/query-keys';

import { settingsApi } from '../api/settings.api';
import type {
  CreateFeatureFlagPayload,
  FeatureFlag,
  UpdateFeatureFlagPayload,
} from '../types/settings.types';

/** All feature flags (`GET /admin/feature-flags`). Gated on `settings.manage`. */
export function useFeatureFlags(): UseQueryResult<FeatureFlag[], Error> {
  const { can } = usePermissions();
  return useQuery<FeatureFlag[], Error>({
    queryKey: qk.settings.featureFlags(),
    queryFn: ({ signal }) => settingsApi.listFlags(signal),
    enabled: can(PERMISSIONS.SettingsManage),
    staleTime: 30_000,
  });
}

export function useCreateFeatureFlag(): UseMutationResult<
  FeatureFlag,
  Error,
  CreateFeatureFlagPayload
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => settingsApi.createFlag(payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.settings.featureFlags() }),
  });
}

/**
 * Update a flag. Optimistically flips the cached row so a toggle feels instant,
 * rolling back on error and reconciling on settle (docs 24 — optimistic where
 * appropriate: a single-field boolean/rollout change is safe to preview).
 */
export function useUpdateFeatureFlag(): UseMutationResult<
  FeatureFlag,
  Error,
  { id: string; payload: UpdateFeatureFlagPayload },
  { previous: FeatureFlag[] | undefined }
> {
  const queryClient = useQueryClient();
  const key = qk.settings.featureFlags();
  return useMutation({
    mutationFn: ({ id, payload }) => settingsApi.updateFlag(id, payload),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FeatureFlag[]>(key);
      if (previous !== undefined) {
        queryClient.setQueryData<FeatureFlag[]>(
          key,
          previous.map((flag) => (flag.id === id ? { ...flag, ...payload } : flag)),
        );
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(key, context.previous);
      }
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteFeatureFlag(): UseMutationResult<void, Error, { id: string }> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => settingsApi.deleteFlag(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.settings.featureFlags() }),
  });
}
