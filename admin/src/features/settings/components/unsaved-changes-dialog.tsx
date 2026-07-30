import type { ReactElement } from 'react';

import { ConfirmationDialog } from '@/components/confirmation-dialog';

interface UnsavedChangesDialogProps {
  open: boolean;
  onDiscard: () => void;
  onCancel: () => void;
}

/**
 * Guards navigation away from a dirty settings form (A7). Reuses the shared
 * `ConfirmationDialog`; "Discard" abandons the edits and proceeds, "Keep editing"
 * cancels the navigation.
 */
export function UnsavedChangesDialog({
  open,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps): ReactElement {
  return (
    <ConfirmationDialog
      open={open}
      danger
      title="Discard unsaved changes?"
      message="You have unsaved changes. Leaving this section will discard them."
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
      onConfirm={onDiscard}
      onCancel={onCancel}
    />
  );
}
