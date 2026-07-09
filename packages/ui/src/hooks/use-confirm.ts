import { App } from 'antd';
import { useCallback } from 'react';
import type { ReactNode } from 'react';

export interface ConfirmOptions {
  title: ReactNode;
  content?: ReactNode;
  okText?: string;
  cancelText?: string;
  /** Destructive confirm styling (docs/06 §4.6). */
  danger?: boolean;
}

/**
 * Promise-based confirm dialog wrapping AntD `App.modal.confirm` (docs/06 §4.6). Reserve
 * for the irreversible; reversible actions use undo toasts instead. Requires an `<App>`
 * provider above. Resolves true on confirm, false on cancel/dismiss.
 */
export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const { modal } = App.useApp();
  return useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        modal.confirm({
          title: options.title,
          content: options.content,
          okText: options.okText ?? 'Confirm',
          cancelText: options.cancelText ?? 'Cancel',
          okButtonProps: { danger: options.danger },
          onOk: () => {
            resolve(true);
          },
          onCancel: () => {
            resolve(false);
          },
        });
      }),
    [modal],
  );
}
