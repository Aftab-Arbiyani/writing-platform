import { QAvatar } from '@qalam/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Dropdown, type MenuProps } from 'antd';
import { BarChart3, FileText, LogOut, Settings, UserPlus, UserRound } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { prefetchDashboard } from '@/features/analytics';
import { useLogout } from '@/features/auth/hooks/use-logout';
import { useMe } from '@/hooks/use-me';
import { mediaUrl } from '@/lib/media';
import { ROUTES } from '@/lib/routes';

/**
 * Authenticated account menu in the top bar (docs/26 §10 — an app-wide composite). Avatar trigger
 * → dropdown to the user's profile, writing, follow requests, settings, and sign-out. Reads the
 * identity query for the avatar/name; sign-out mirrors the standalone logout (clear + redirect).
 */
export function UserMenu(): ReactElement {
  const navigate = useNavigate();
  const client = useQueryClient();
  const me = useMe();
  const logout = useLogout();
  const name = me.data?.penName ?? me.data?.username ?? 'You';

  const onSignOut = (): void => {
    logout.mutate(undefined, {
      onSettled: () => {
        void navigate(ROUTES.landing, { replace: true });
      },
    });
  };

  const items: MenuProps['items'] = [
    {
      key: 'identity',
      type: 'group',
      label: (
        <span className="flex flex-col py-1">
          <span className="truncate font-medium text-ink">
            <bdi>{name}</bdi>
          </span>
          {me.data ? (
            <span dir="ltr" className="truncate text-xs text-ink-muted">
              <bdi>@{me.data.username}</bdi>
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'profile',
      icon: <UserRound size={16} strokeWidth={1.5} />,
      label: 'Your profile',
      onClick: () => void navigate(ROUTES.me),
    },
    {
      key: 'writing',
      icon: <FileText size={16} strokeWidth={1.5} />,
      label: 'Your writing',
      onClick: () => void navigate(ROUTES.drafts),
    },
    {
      key: 'stats',
      icon: <BarChart3 size={16} strokeWidth={1.5} />,
      label: 'Your stats',
      onClick: () => void navigate(ROUTES.stats),
    },
    {
      key: 'requests',
      icon: <UserPlus size={16} strokeWidth={1.5} />,
      label: 'Follow requests',
      onClick: () => void navigate(ROUTES.followRequests),
    },
    {
      key: 'settings',
      icon: <Settings size={16} strokeWidth={1.5} />,
      label: 'Settings',
      onClick: () => void navigate(ROUTES.settingsProfile),
    },
    { type: 'divider' },
    {
      key: 'signout',
      icon: <LogOut size={16} strokeWidth={1.5} />,
      label: 'Sign out',
      danger: true,
      onClick: onSignOut,
    },
  ];

  return (
    <Dropdown
      menu={{ items }}
      trigger={['click']}
      placement="bottomRight"
      onOpenChange={(open) => {
        // Warm the analytics dashboard on menu open (docs: prefetch dashboard overview).
        if (open) void prefetchDashboard(client);
      }}
    >
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <QAvatar size="sm" src={mediaUrl(me.data?.avatarKey)} name={name} />
      </button>
    </Dropdown>
  );
}
