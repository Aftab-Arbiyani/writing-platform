import { ConfigProvider, Menu, type MenuProps } from 'antd';
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

/**
 * The collapsed rail's inner width, in px — it MUST track `w-16` on the `<aside>` in
 * `admin-shell.tsx`. AntD derives a collapsed menu's width from `controlHeightLG * 2`, and the
 * shared theme raises `controlHeight` to 40, so its default here is 100px — 36px wider than the
 * rail it sits in. That overflow is what pushed the icons off-centre and clipped them.
 */
const COLLAPSED_RAIL_PX = 64;

export function AppSidebar({ collapsed = false, onNavigate }: AppSidebarProps): ReactElement {
  const { hasRole } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const items: NonNullable<MenuProps['items']> = [];
  for (const group of NAV_GROUPS) {
    const visible = group.items.filter((item) => hasRole(item.minRole));
    if (visible.length === 0) continue;
    const entries = visible.map((item) => ({
      key: item.path,
      icon: createElement(item.icon, { size: 18, 'aria-hidden': true }),
      label: item.label,
    }));
    if (collapsed) {
      /*
       * Collapsed, the groups flatten to their items with a rule between them. AntD keeps
       * rendering a group's title in an `inlineCollapsed` menu — it does not hide it — so at
       * rail width "Moderation" and "Platform" were drawn at full length and clipped mid-word.
       * A divider keeps the grouping legible in the space a title cannot fit.
       */
      if (items.length > 0) items.push({ type: 'divider', key: `${group.key}-divider` });
      items.push(...entries);
      continue;
    }
    items.push({ key: group.key, type: 'group', label: group.label, children: entries });
  }

  const active = NAV_ITEMS.find((item) => location.pathname.startsWith(item.path))?.path;

  const onClick: MenuProps['onClick'] = ({ key }) => {
    void navigate(key);
    onNavigate?.();
  };

  return (
    <nav aria-label="Admin sections" className="h-full overflow-y-auto py-2">
      {/* Scoped to this menu: `collapsedWidth` is a consequence of the rail's width, not a
          design-system value, so it is set here beside the constant rather than in the shared
          theme every app reads. */}
      <ConfigProvider theme={{ components: { Menu: { collapsedWidth: COLLAPSED_RAIL_PX } } }}>
        <Menu
          mode="inline"
          items={items}
          selectedKeys={active ? [active] : []}
          onClick={onClick}
          inlineCollapsed={collapsed}
          style={{ border: 'none', background: 'transparent' }}
        />
      </ConfigProvider>
    </nav>
  );
}
