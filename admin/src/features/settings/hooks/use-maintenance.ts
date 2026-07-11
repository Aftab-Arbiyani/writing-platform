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
import type { Maintenance, UpdateMaintenancePayload } from '../types/settings.types';

/** Maintenance-mode state (`GET /admin/maintenance`). Gated on `settings.manage`. */
export function useMaintenance(): UseQueryResult<Maintenance, Error> {
  const { can } = usePermissions();
  return useQuery<Maintenance, Error>({
    queryKey: qk.settings.maintenance(),
    queryFn: ({ signal }) => settingsApi.getMaintenance(signal),
    enabled: can(PERMISSIONS.SettingsManage),
    staleTime: 30_000,
  });
}

/** Update maintenance mode (`PATCH /admin/maintenance`); refreshes the cached view. */
export function useUpdateMaintenance(): UseMutationResult<
  Maintenance,
  Error,
  UpdateMaintenancePayload
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => settingsApi.updateMaintenance(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.settings.maintenance(), data);
      // Maintenance is also backed by the maintenance.* settings rows.
      void queryClient.invalidateQueries({ queryKey: qk.settings.list() });
    },
  });
}
