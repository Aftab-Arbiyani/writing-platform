import { QAvatar } from '@qalam/ui';
import { Dropdown, type MenuProps } from 'antd';
import { LogOut } from 'lucide-react';
import { createElement, type ReactElement } from 'react';

import { useLogout } from '@/features/auth';
import { useMe } from '@/hooks/use-me';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Admin account menu (docs/10 §3.4). Identity (name/handle) comes from `useMe` (`GET /me`); the role
 * comes from the JWT via the auth store. Sign-out runs the logout mutation (revoke + clear); the
 * store then goes anonymous and `RequireAuth` routes to /login automatically.
 */
export function UserMenu(): ReactElement | null {
  const status = useAuthStore((state) => state.status);
  const role = useAuthStore((state) => state.role);
  const me = useMe();
  const logout = useLogout();

  if (status !== 'authenticated') return null;

  const name = me.data?.penName ?? me.data?.username ?? 'Admin';
  const handle = me.data?.username;

  const items: MenuProps['items'] = [
    {
      key: 'identity',
      type: 'group',
      label: (
        <div className="flex flex-col py-1">
          <span className="text-sm font-medium text-ink">{name}</span>
          {handle ? <span className="text-xs text-ink-muted">@{handle}</span> : null}
          {role ? (
            <span className="mt-1 text-xs uppercase tracking-wide text-ink-secondary">{role}</span>
          ) : null}
        </div>
      ),
    },
    { type: 'divider' },
    {
      key: 'sign-out',
      label: 'Sign out',
      icon: createElement(LogOut, { size: 16, 'aria-hidden': true }),
      disabled: logout.isPending,
      onClick: () => logout.mutate(),
    },
  ];

  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
      <button
        type="button"
        aria-label={`Account menu for ${name}`}
        className="flex items-center gap-2 rounded-md p-1 hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--q-accent)]"
      >
        <QAvatar name={name} size={28} />
      </button>
    </Dropdown>
  );
}
