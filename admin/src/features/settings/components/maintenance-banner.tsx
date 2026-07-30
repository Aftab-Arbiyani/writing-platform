import { Alert } from 'antd';
import type { ReactElement } from 'react';

import { formatDateTime } from '@/lib/format';

import { useMaintenance } from '../hooks/use-maintenance';

/**
 * A prominent banner shown at the top of Settings while maintenance mode is ON
 * (A7). Reads the same cached query as the section, so it flips the moment the
 * toggle is saved. Renders nothing when disabled or still loading.
 */
export function MaintenanceBanner(): ReactElement | null {
  const { data } = useMaintenance();
  if (data === undefined || !data.enabled) {
    return null;
  }
  const until =
    data.estimatedCompletion !== null
      ? ` Estimated back: ${formatDateTime(data.estimatedCompletion)}.`
      : '';
  return (
    <Alert
      type="warning"
      showIcon
      banner
      message="Maintenance mode is active"
      description={`${data.message}${until} Access is limited to: ${data.allowedRoles.join(', ') || 'no one'}.`}
      className="mb-4"
      role="status"
    />
  );
}
