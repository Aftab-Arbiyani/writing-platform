import { Avatar, Tag, type TableColumnsType } from 'antd';

import { StatusBadge } from '@/components/status-badge';
import { formatCount, formatDate, formatDateTime } from '@/lib/format';
import { mediaUrl } from '@/lib/media';

import { ROLE_LABELS } from '../users.constants';
import type { AdminUserListItem, UserAction } from '../types/users.types';
import { UserRowActions } from './user-row-actions';

interface BuildColumnsOptions {
  hiddenColumns: string[];
  sort: string;
  currentUserId: string | null;
  onView: (user: AdminUserListItem) => void;
  onEdit: (user: AdminUserListItem) => void;
  onAction: (user: AdminUserListItem, action: UserAction) => void;
}

type SortOrder = 'ascend' | 'descend' | null;

/** Controlled sort arrow for a column, derived from the URL `sort` token. */
function sortOrderFor(columnKey: string, sort: string): SortOrder {
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  if (field !== columnKey) {
    return null;
  }
  return desc ? 'descend' : 'ascend';
}

const dash = <span className="text-ink-muted">—</span>;
const initialOf = (user: AdminUserListItem): string =>
  (user.displayName ?? user.username).slice(0, 1).toUpperCase();

/**
 * Builds the AntD column set for the user grid. Hidden columns (from the prefs
 * store) are filtered out; sortable columns carry a controlled `sortOrder` so the
 * arrow matches the URL; the actions column is pinned right. `key` on sortable
 * columns is the backend sort token — no translation on capture.
 */
export function buildUserColumns(
  options: BuildColumnsOptions,
): TableColumnsType<AdminUserListItem> {
  const { hiddenColumns, sort, currentUserId, onView, onEdit, onAction } = options;
  const hidden = new Set(hiddenColumns);
  const columns: TableColumnsType<AdminUserListItem> = [];

  const show = (key: string): boolean => !hidden.has(key);

  if (show('avatar')) {
    columns.push({
      key: 'avatar',
      title: '',
      width: 56,
      render: (_, user) => (
        <Avatar
          size="small"
          src={mediaUrl(user.avatarKey)}
          alt={user.username}
          style={{ backgroundColor: 'var(--q-accent)' }}
        >
          {initialOf(user)}
        </Avatar>
      ),
    });
  }
  if (show('username')) {
    columns.push({
      key: 'username',
      title: 'Username',
      dataIndex: 'username',
      sorter: true,
      sortOrder: sortOrderFor('username', sort),
      render: (_, user) => (
        <button
          type="button"
          className="font-medium text-accent hover:underline"
          onClick={() => onView(user)}
        >
          @{user.username}
        </button>
      ),
    });
  }
  if (show('penName')) {
    columns.push({
      key: 'penName',
      title: 'Display name',
      dataIndex: 'displayName',
      sorter: true,
      sortOrder: sortOrderFor('penName', sort),
      render: (value: string | null) => value ?? dash,
    });
  }
  if (show('email')) {
    columns.push({
      key: 'email',
      title: 'Email',
      dataIndex: 'email',
      sorter: true,
      sortOrder: sortOrderFor('email', sort),
      ellipsis: true,
    });
  }
  if (show('role')) {
    columns.push({
      key: 'role',
      title: 'Role',
      dataIndex: 'role',
      render: (role: string) => <Tag>{ROLE_LABELS[role] ?? role}</Tag>,
    });
  }
  if (show('status')) {
    columns.push({
      key: 'status',
      title: 'Status',
      dataIndex: 'status',
      sorter: true,
      sortOrder: sortOrderFor('status', sort),
      render: (status: string) => <StatusBadge status={status} />,
    });
  }
  if (show('verified')) {
    columns.push({
      key: 'verified',
      title: 'Verification',
      dataIndex: 'verified',
      render: (verified: boolean) =>
        verified ? (
          <StatusBadge status="verified" label="Verified" />
        ) : (
          <StatusBadge status="unverified" label="Unverified" tone="neutral" />
        ),
    });
  }
  if (show('visibility')) {
    columns.push({
      key: 'visibility',
      title: 'Visibility',
      dataIndex: 'isPrivate',
      render: (isPrivate: boolean) => <Tag>{isPrivate ? 'Private' : 'Public'}</Tag>,
    });
  }

  const numeric = (key: string, title: string, field: keyof AdminUserListItem): void => {
    if (!show(key)) {
      return;
    }
    columns.push({
      key,
      title,
      dataIndex: field,
      align: 'right',
      className: 'tabular-nums',
      sorter: key !== 'draftCount',
      sortOrder: key === 'draftCount' ? undefined : sortOrderFor(key, sort),
      render: (value: number) => formatCount(value),
    });
  };
  numeric('followers', 'Followers', 'followers');
  numeric('following', 'Following', 'following');
  numeric('pieces', 'Published', 'publishedPieces');
  numeric('draftCount', 'Drafts', 'draftCount');

  if (show('createdAt')) {
    columns.push({
      key: 'createdAt',
      title: 'Created',
      dataIndex: 'createdAt',
      sorter: true,
      sortOrder: sortOrderFor('createdAt', sort),
      render: (value: string) => formatDate(value),
    });
  }
  if (show('lastLoginAt')) {
    columns.push({
      key: 'lastLoginAt',
      title: 'Last login',
      dataIndex: 'lastLoginAt',
      sorter: true,
      sortOrder: sortOrderFor('lastLoginAt', sort),
      render: (value: string | null) => (value === null ? dash : formatDateTime(value)),
    });
  }
  if (show('lastActiveAt')) {
    columns.push({
      key: 'lastActiveAt',
      title: 'Last active',
      dataIndex: 'lastActiveAt',
      render: (value: string | null) => (value === null ? dash : formatDateTime(value)),
    });
  }

  columns.push({
    key: 'actions',
    title: '',
    fixed: 'right',
    width: 64,
    render: (_, user) => (
      <UserRowActions
        user={user}
        isSelf={user.id === currentUserId}
        onView={() => onView(user)}
        onEdit={() => onEdit(user)}
        onAction={(action) => onAction(user, action)}
      />
    ),
  });

  return columns;
}
