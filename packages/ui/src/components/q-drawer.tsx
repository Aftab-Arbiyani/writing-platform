import { Drawer } from 'antd';
import type { ReactElement, ReactNode } from 'react';

export interface QDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Physical placement; RTL mirroring is handled by the AntD ConfigProvider `direction`. */
  placement?: 'left' | 'right' | 'top' | 'bottom';
  width?: number | string;
  children: ReactNode;
}

/**
 * Side sheet wrapping AntD `Drawer` (docs/07 §7.4). Used for the publish flow, filter
 * panels, mobile nav. Focus trap + scroll lock are AntD's; tokens via ConfigProvider.
 */
export function QDrawer({
  open,
  onClose,
  title,
  placement = 'right',
  width = 480,
  children,
}: QDrawerProps): ReactElement {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      placement={placement}
      width={width}
      destroyOnHidden
    >
      {children}
    </Drawer>
  );
}
