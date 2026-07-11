import { PERMISSIONS } from '@qalam/shared';
import { QButton, useToast } from '@qalam/ui';
import { Popover, Select } from 'antd';
import { useState, type ReactElement } from 'react';

import { BulkActionBar } from '@/components/bulk-action-bar';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import type { BulkSelection } from '@/hooks/use-bulk-selection';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorMessage } from '@/lib/errors';

import { useBulkReports } from '../hooks/use-moderation-mutations';
import { useModerators } from '../hooks/use-reports';
import type { BulkReportAction } from '../types/moderation.types';

const CONFIRM: ReadonlySet<BulkReportAction> = new Set([
  'approve',
  'reject',
  'hide',
  'restore',
  'close',
]);
const DANGER: ReadonlySet<BulkReportAction> = new Set(['reject', 'hide']);
const LABELS: Record<BulkReportAction, string> = {
  approve: 'Approve',
  reject: 'Reject',
  assign: 'Assign',
  hide: 'Hide',
  restore: 'Restore',
  close: 'Close',
};

/** Bulk moderation for the current selection. Destructive ops confirm; assign uses a popover. */
export function ReportBulkBar({ selection }: { selection: BulkSelection }): ReactElement | null {
  const { can } = usePermissions();
  const toast = useToast();
  const bulk = useBulkReports();
  const moderators = useModerators();
  const [pending, setPending] = useState<BulkReportAction | null>(null);
  const [assignId, setAssignId] = useState<string | undefined>(undefined);

  if (!can(PERMISSIONS.ReportResolve)) {
    return null;
  }

  const run = (action: BulkReportAction, moderatorId?: string): void => {
    bulk.mutate(
      { action, reportIds: selection.selectedIds, moderatorId },
      {
        onSuccess: (result) => {
          if (result.failed.length > 0) {
            toast.warning(`${result.succeeded.length} done, ${result.failed.length} failed.`);
          } else {
            toast.success(`${LABELS[action]} applied to ${result.succeeded.length} reports.`);
          }
          selection.clear();
        },
        onError: (error) => toast.error(getErrorMessage(error)),
        onSettled: () => setPending(null),
      },
    );
  };

  const button = (action: BulkReportAction): ReactElement => (
    <QButton
      variant={DANGER.has(action) ? 'danger' : 'secondary'}
      size="sm"
      loading={bulk.isPending && pending === action}
      onClick={() => (CONFIRM.has(action) ? setPending(action) : run(action))}
    >
      {LABELS[action]}
    </QButton>
  );

  const assignMenu = (
    <div className="flex w-64 flex-col gap-2">
      <Select
        showSearch
        size="small"
        loading={moderators.isLoading}
        placeholder="Assign to…"
        value={assignId}
        options={(moderators.data ?? []).map((mod) => ({
          label: `${mod.displayName ?? mod.username} · ${mod.role}`,
          value: mod.id,
        }))}
        onChange={setAssignId}
        filterOption={(input, option) =>
          String(option?.label ?? '')
            .toLowerCase()
            .includes(input.toLowerCase())
        }
      />
      <QButton
        variant="primary"
        size="sm"
        disabled={assignId === undefined}
        onClick={() => assignId !== undefined && run('assign', assignId)}
      >
        Assign {selection.selectedCount}
      </QButton>
    </div>
  );

  return (
    <>
      <BulkActionBar
        selectedCount={selection.selectedCount}
        onClear={selection.clear}
        itemLabel="report"
      >
        {button('approve')}
        {button('reject')}
        {button('hide')}
        {button('restore')}
        {button('close')}
        <Popover content={assignMenu} trigger="click" placement="top">
          <QButton variant="secondary" size="sm">
            Assign
          </QButton>
        </Popover>
      </BulkActionBar>
      <ConfirmationDialog
        open={pending !== null}
        title={`${pending !== null ? LABELS[pending] : ''} ${selection.selectedCount} reports?`}
        message="This applies to every selected report and is recorded in the audit trail. Content take-down and account actions run immediately where applicable."
        danger={pending !== null && DANGER.has(pending)}
        confirmLabel={pending !== null ? LABELS[pending] : 'Confirm'}
        loading={bulk.isPending}
        onConfirm={() => pending !== null && run(pending)}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
