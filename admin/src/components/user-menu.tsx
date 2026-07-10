import { QAvatar } from '@qalam/ui';
import { Dropdown, type MenuProps } from 'antd';
import { LogOut } from 'lucide-react';
import { createElement, type ReactElement } from 'react';

import { useAuthStore } from '@/stores/auth.store';

/**
 * Admin account menu (docs/10 §3.4). Shows the signed-in operator + role and a sign-out action.
 * Sign-out clears the in-memory session; the real logout endpoint + redirect land with the auth
 * epic (no auth UI in A1) — `clearSession` is the foundation stub.
 */
export function UserMenu(): ReactElement | null {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  if (!user) return null;

  const items: MenuProps['items'] = [
    {
      key: 'identity',
      type: 'group',
      label: (
        <div className="flex flex-col py-1">
          <span className="text-sm font-medium text-ink">{user.name}</span>
          <span className="text-xs text-ink-muted">{user.email}</span>
          <span className="mt-1 text-xs uppercase tracking-wide text-ink-secondary">
            {user.role}
          </span>
        </div>
      ),
    },
    { type: 'divider' },
    {
      key: 'sign-out',
      label: 'Sign out',
      icon: createElement(LogOut, { size: 16, 'aria-hidden': true }),
      onClick: () => clearSession(),
    },
  ];

  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
      <button
        type="button"
        aria-label={`Account menu for ${user.name}`}
        className="flex items-center gap-2 rounded-md p-1 hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--q-accent)]"
      >
        <QAvatar name={user.name} size={28} />
      </button>
    </Dropdown>
  );
}
