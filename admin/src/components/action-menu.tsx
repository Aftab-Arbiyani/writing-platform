import { QButton } from '@qalam/ui';
import { Dropdown, type MenuProps } from 'antd';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { createElement, type ReactElement } from 'react';

/**
 * Row/entity action menu — an AntD `Dropdown` behind an icon trigger. Keyboard-operable (AntD wires
 * roving focus + Esc); the trigger carries an explicit `aria-label` since it is icon-only. Use for
 * the per-row "⋯" actions in `DataTable` (visible on hover AND focus-within, docs/07 §7.5).
 */
export interface ActionMenuItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export interface ActionMenuProps {
  items: ActionMenuItem[];
  ariaLabel?: string;
}

export function ActionMenu({ items, ariaLabel = 'Actions' }: ActionMenuProps): ReactElement {
  const menuItems: MenuProps['items'] = items.map((item) => ({
    key: item.key,
    label: item.label,
    danger: item.danger,
    disabled: item.disabled,
    icon: item.icon ? createElement(item.icon, { size: 16, 'aria-hidden': true }) : undefined,
  }));

  const onClick: MenuProps['onClick'] = ({ key }) => {
    items.find((item) => item.key === key)?.onClick();
  };

  return (
    <Dropdown menu={{ items: menuItems, onClick }} trigger={['click']} placement="bottomRight">
      <QButton variant="ghost" size="sm" icon={MoreHorizontal} aria-label={ariaLabel} />
    </Dropdown>
  );
}
