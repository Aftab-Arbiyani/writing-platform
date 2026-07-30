import { QButton, QDialog } from '@qalam/ui';
import type { ReactElement, ReactNode } from 'react';

/**
 * Controlled confirm dialog for destructive/consequential admin actions (docs/07 §7.4). Built on
 * `QDialog`: when `danger`, Esc + mask dismissal are disabled so a delete needs an explicit choice.
 * `loading` disables the buttons while the mutation runs. The action itself + audit logging happen
 * server-side; this only gathers intent.
 */
export interface ConfirmationDialogProps {
  open: boolean;
  title: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps): ReactElement {
  return (
    <QDialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      danger={danger}
      footer={
        <div className="flex justify-end gap-2">
          <QButton variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </QButton>
          <QButton variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </QButton>
        </div>
      }
    >
      <p className="text-sm text-ink-secondary">{message}</p>
    </QDialog>
  );
}
