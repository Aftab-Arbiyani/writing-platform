import { useToast } from '@qalam/ui';
import { Input } from 'antd';
import { useState, type ReactElement } from 'react';

import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { getErrorMessage } from '@/lib/errors';

import { useUserAction } from '../hooks/use-user-mutations';
import type { AdminUserListItem } from '../types/users.types';
import { ACTION_META, type ConfirmableAction } from './confirm-action-meta';

interface ConfirmActionDialogProps {
  pending: { user: AdminUserListItem; action: ConfirmableAction } | null;
  onClose: () => void;
}

/**
 * Confirmation for a destructive/sensitive single-user action. Shows consequences
 * and (for suspend/deactivate) an optional reason recorded in the audit trail.
 * Runs the mutation on confirm and reports success/failure via a toast.
 */
export function ConfirmActionDialog({
  pending,
  onClose,
}: ConfirmActionDialogProps): ReactElement | null {
  const toast = useToast();
  const action = useUserAction();
  const [reason, setReason] = useState('');

  if (pending === null) {
    return null;
  }
  const meta = ACTION_META[pending.action];

  const close = (): void => {
    setReason('');
    onClose();
  };

  const confirm = (): void => {
    action.mutate(
      { id: pending.user.id, action: pending.action, reason: reason.trim() || undefined },
      {
        onSuccess: (result) => {
          toast.success(result.message);
          close();
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  return (
    <ConfirmationDialog
      open
      title={meta.title(pending.user.username)}
      danger={meta.danger}
      confirmLabel={meta.confirmLabel}
      loading={action.isPending}
      onConfirm={confirm}
      onCancel={close}
      message={
        <div className="flex flex-col gap-3">
          <ul className="ms-4 list-disc text-sm text-ink-secondary">
            {meta.consequences.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {meta.reason ? (
            <label className="flex flex-col gap-1 text-sm text-ink">
              Reason (optional, audited)
              <Input.TextArea
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          ) : null}
        </div>
      }
    />
  );
}
