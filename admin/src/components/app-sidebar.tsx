import { Menu, type MenuProps } from 'antd';
import { createElement, type ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { NAV_GROUPS, NAV_ITEMS } from '@/components/nav-config';
import { usePermissions } from '@/hooks/use-permissions';

/**
 * The role-filtered side navigation (docs/10 §3.4, docs/11 §8). Renders only the groups/items the
 * current role can enter — a moderator never sees `/roles`. Selection follows the URL. Navigation is
 * router-driven (not `<a href>`) to keep the SPA transition. `onNavigate` lets the mobile drawer
 * close itself after a jump.
 */
export interface AppSidebarProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function AppSidebar({ collapsed = false, onNavigate }: AppSidebarProps): ReactElement {
  const { hasRole } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const items: NonNullable<MenuProps['items']> = [];
  for (const group of NAV_GROUPS) {
    const visible = group.items.filter((item) => hasRole(item.minRole));
    if (visible.length === 0) continue;
    items.push({
      key: group.key,
      type: 'group',
      label: group.label,
      children: visible.map((item) => ({
        key: item.path,
        icon: createElement(item.icon, { size: 18, 'aria-hidden': true }),
        label: item.label,
      })),
    });
  }

  const active = NAV_ITEMS.find((item) => location.pathname.startsWith(item.path))?.path;

  const onClick: MenuProps['onClick'] = ({ key }) => {
    void navigate(key);
    onNavigate?.();
  };

  return (
    <nav aria-label="Admin sections" className="h-full overflow-y-auto py-2">
      <Menu
        mode="inline"
        items={items}
        selectedKeys={active ? [active] : []}
        onClick={onClick}
        inlineCollapsed={collapsed}
        style={{ border: 'none', background: 'transparent' }}
      />
    </nav>
  );
}
