import { Modal } from 'antd';
import type { ReactElement, ReactNode } from 'react';

export interface QDialogProps {
  open: boolean;
  /** Fires on Esc / mask click / close button (Esc + mask disabled when `danger`). */
  onClose: () => void;
  /** Required — a dialog without a name fails ARIA (docs/08 §3.1). */
  title: ReactNode;
  description?: ReactNode;
  /** 400 / 560 / 720 px (docs/07 §7.4). */
  size?: 'sm' | 'md' | 'lg';
  /** Footer slot; omit → no footer (content-driven). */
  footer?: ReactNode;
  danger?: boolean;
  children: ReactNode;
}

const WIDTH: Record<'sm' | 'md' | 'lg', number> = { sm: 400, md: 560, lg: 720 };

/**
 * Dialog wrapping AntD `Modal` (docs/07 §7.4). Focus trap, scroll lock, and portal
 * stacking are AntD's; we own tokens + the danger-confirm behavior (no Esc/mask dismissal).
 */
export function QDialog({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  danger = false,
  children,
}: QDialogProps): ReactElement {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={title}
      width={WIDTH[size]}
      footer={footer ?? null}
      maskClosable={!danger}
      keyboard={!danger}
      destroyOnHidden
    >
      {description ? <p className="mb-3 text-sm text-ink-secondary">{description}</p> : null}
      {children}
    </Modal>
  );
}
