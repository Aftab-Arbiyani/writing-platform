import { QDialog, type QDialogProps } from '@qalam/ui';
import type { ReactElement } from 'react';

/**
 * Admin modal — the shared `QDialog` (focus trap, scroll lock, tokens, danger-confirm behaviour all
 * handled there), re-exposed under the admin vocabulary. Reuse over reinvention (docs/03 §5). Admin
 * "rich pickers" default to the `lg` (720px) size (docs/07 §7.4); override per call.
 */
export type ModalProps = QDialogProps;

export function Modal({ size = 'lg', ...rest }: ModalProps): ReactElement {
  return <QDialog size={size} {...rest} />;
}
