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
import type { Setting, UpdateSettingsPayload } from '../types/settings.types';

/** All platform settings (`GET /admin/settings`). Gated on `settings.manage` (admin+). */
export function useSettings(): UseQueryResult<Setting[], Error> {
  const { can } = usePermissions();
  return useQuery<Setting[], Error>({
    queryKey: qk.settings.list(),
    queryFn: ({ signal }) => settingsApi.getAll(signal),
    enabled: can(PERMISSIONS.SettingsManage),
    staleTime: 30_000,
  });
}

/** Batch-update settings in one category (`PATCH /admin/settings/:category`). */
export function useUpdateSettings(): UseMutationResult<
  Setting[],
  Error,
  { category: string; payload: UpdateSettingsPayload }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ category, payload }) => settingsApi.updateCategory(category, payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.settings.all }),
  });
}
