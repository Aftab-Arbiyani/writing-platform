import { QDrawer, type QDrawerProps } from '@qalam/ui';
import type { ReactElement } from 'react';

/**
 * Admin side sheet — the shared `QDrawer` (focus trap + scroll lock via AntD; tokens via the theme
 * provider), re-exposed under the admin vocabulary. Defaults to a slightly wider 560px panel suited
 * to admin detail/edit forms; override with `width`. Placement mirrors under RTL automatically.
 */
export type DrawerProps = QDrawerProps;

export function Drawer({ width = 560, ...rest }: DrawerProps): ReactElement {
  return <QDrawer width={width} {...rest} />;
}
