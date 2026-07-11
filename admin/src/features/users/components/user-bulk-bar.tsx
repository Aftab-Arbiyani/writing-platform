import { PERMISSIONS } from '@qalam/shared';
import { QButton, useToast } from '@qalam/ui';
import { useState, type ReactElement } from 'react';

import { BulkActionBar } from '@/components/bulk-action-bar';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import type { BulkSelection } from '@/hooks/use-bulk-selection';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorMessage } from '@/lib/errors';

import { useBulkUserAction } from '../hooks/use-user-mutations';
import type { BulkAction } from '../types/users.types';

const DESTRUCTIVE = new Set<BulkAction>(['suspend', 'deactivate', 'force_logout']);
const LABELS: Record<BulkAction, string> = {
  verify: 'Verify',
  suspend: 'Suspend',
  activate: 'Activate',
  deactivate: 'Deactivate',
  force_logout: 'Force logout',
  export: 'Export',
};

/** Downloads the selected users as a JSON file (bulk export returns rows in `data`). */
function downloadJson(rows: Array<Record<string, unknown>>): void {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `qalam-users-selected-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Bulk-action bar for the current selection. Destructive ops confirm; export downloads JSON. */
export function UserBulkBar({ selection }: { selection: BulkSelection }): ReactElement {
  const { can } = usePermissions();
  const toast = useToast();
  const bulk = useBulkUserAction();
  const [pending, setPending] = useState<BulkAction | null>(null);

  const run = (action: BulkAction): void => {
    bulk.mutate(
      { action, userIds: selection.selectedIds },
      {
        onSuccess: (result) => {
          if (action === 'export') {
            downloadJson(result.data ?? []);
            toast.success(`Exported ${result.data?.length ?? 0} users.`);
            return;
          }
          if (result.failed.length > 0) {
            toast.warning(`${result.succeeded.length} done, ${result.failed.length} failed.`);
          } else {
            toast.success(`${LABELS[action]} applied to ${result.succeeded.length} users.`);
          }
          selection.clear();
        },
        onError: (error) => toast.error(getErrorMessage(error)),
        onSettled: () => setPending(null),
      },
    );
  };

  const trigger = (action: BulkAction): void => {
    if (DESTRUCTIVE.has(action)) {
      setPending(action);
    } else {
      run(action);
    }
  };

  const button = (action: BulkAction, permission: string, danger = false): ReactElement | null =>
    can(permission) ? (
      <QButton
        variant={danger ? 'danger' : 'secondary'}
        size="sm"
        loading={bulk.isPending && pending === action}
        onClick={() => trigger(action)}
      >
        {LABELS[action]}
      </QButton>
    ) : null;

  return (
    <>
      <BulkActionBar
        selectedCount={selection.selectedCount}
        onClear={selection.clear}
        itemLabel="user"
      >
        {button('verify', PERMISSIONS.UserUpdate)}
        {button('activate', PERMISSIONS.UserRestore)}
        {button('suspend', PERMISSIONS.UserSuspend, true)}
        {button('deactivate', PERMISSIONS.UserSuspend, true)}
        {button('force_logout', PERMISSIONS.UserSuspend, true)}
        {button('export', PERMISSIONS.UserView)}
      </BulkActionBar>
      <ConfirmationDialog
        open={pending !== null && DESTRUCTIVE.has(pending)}
        title={`${pending !== null ? LABELS[pending] : ''} ${selection.selectedCount} users?`}
        message="This applies to every selected account and is recorded in the audit trail. Sessions are revoked immediately where applicable."
        danger
        confirmLabel={pending !== null ? LABELS[pending] : 'Confirm'}
        loading={bulk.isPending}
        onConfirm={() => pending !== null && run(pending)}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
