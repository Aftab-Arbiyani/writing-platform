import { PERMISSIONS, UserStatus } from '@qalam/shared';
import {
  Ban,
  Eye,
  KeyRound,
  LogOut,
  Pencil,
  Power,
  PowerOff,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import type { ReactElement } from 'react';

import { ActionMenu, type ActionMenuItem } from '@/components/action-menu';
import { usePermissions } from '@/hooks/use-permissions';

import type { AdminUserListItem, UserAction } from '../types/users.types';

interface UserRowActionsProps {
  user: AdminUserListItem;
  isSelf: boolean;
  onView: () => void;
  onEdit: () => void;
  onAction: (action: UserAction) => void;
}

/**
 * Per-row "⋯" menu. Items are permission-gated (`can(...)`) and status-aware
 * (suspend↔unsuspend, deactivate↔reactivate flip on the current status).
 * Destructive self-actions are disabled — the server blocks them anyway, so this
 * is a UX guard, not a security boundary.
 */
export function UserRowActions({
  user,
  isSelf,
  onView,
  onEdit,
  onAction,
}: UserRowActionsProps): ReactElement {
  const { can } = usePermissions();
  const items: ActionMenuItem[] = [];

  items.push({ key: 'view', label: 'View profile', icon: Eye, onClick: onView });

  if (can(PERMISSIONS.UserUpdate)) {
    items.push({ key: 'edit', label: 'Edit user', icon: Pencil, onClick: onEdit });
    if (!user.verified) {
      items.push({
        key: 'verify',
        label: 'Verify user',
        icon: ShieldCheck,
        onClick: () => onAction('verify'),
      });
    }
  }

  if (can(PERMISSIONS.UserSuspend)) {
    if (user.status === UserStatus.Suspended) {
      if (can(PERMISSIONS.UserRestore)) {
        items.push({
          key: 'unsuspend',
          label: 'Lift suspension',
          icon: Undo2,
          onClick: () => onAction('unsuspend'),
        });
      }
    } else {
      items.push({
        key: 'suspend',
        label: 'Suspend',
        icon: Ban,
        danger: true,
        disabled: isSelf,
        onClick: () => onAction('suspend'),
      });
    }

    if (user.status === UserStatus.Deactivated) {
      if (can(PERMISSIONS.UserRestore)) {
        items.push({
          key: 'reactivate',
          label: 'Reactivate',
          icon: Power,
          onClick: () => onAction('reactivate'),
        });
      }
    } else {
      items.push({
        key: 'deactivate',
        label: 'Deactivate',
        icon: PowerOff,
        danger: true,
        disabled: isSelf,
        onClick: () => onAction('deactivate'),
      });
    }
  }

  if (can(PERMISSIONS.UserUpdate)) {
    items.push({
      key: 'reset-password',
      label: 'Reset password',
      icon: KeyRound,
      onClick: () => onAction('reset-password'),
    });
  }

  if (can(PERMISSIONS.UserSuspend)) {
    items.push({
      key: 'force-logout',
      label: 'Force logout',
      icon: LogOut,
      danger: true,
      disabled: isSelf,
      onClick: () => onAction('force-logout'),
    });
  }

  return <ActionMenu items={items} ariaLabel={`Actions for ${user.username}`} />;
}
