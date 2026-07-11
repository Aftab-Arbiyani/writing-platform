import { PERMISSIONS } from '@qalam/shared';
import { QButton } from '@qalam/ui';
import { Descriptions, Tabs, Tag } from 'antd';
import { Pencil } from 'lucide-react';
import { useState, type ReactElement, type ReactNode } from 'react';

import { Drawer } from '@/components/drawer';
import { EmptyState } from '@/components/empty-state';
import { LoadingState } from '@/components/loading-state';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorMessage } from '@/lib/errors';
import { formatCount, formatDate, formatDateTime } from '@/lib/format';

import { useUser, useUserActivity, useUserLoginHistory } from '../hooks/use-user';
import { ROLE_LABELS } from '../users.constants';
import type { AdminUserDetail, AdminUserListItem, AuditLogEntry } from '../types/users.types';
import { AuditEntryRow } from './audit-entry-row';
import { UserAuditTab } from './user-audit-tab';

interface UserDetailDrawerProps {
  user: AdminUserListItem | null;
  onClose: () => void;
  onEdit: () => void;
}

function auditList(entries: AuditLogEntry[], emptyLabel: string): ReactElement {
  if (entries.length === 0) {
    return <p className="py-2 text-sm text-ink-muted">{emptyLabel}</p>;
  }
  return (
    <ul className="flex flex-col">
      {entries.map((entry) => (
        <AuditEntryRow key={entry.id} entry={entry} />
      ))}
    </ul>
  );
}

function Overview({ detail }: { detail: AdminUserDetail }): ReactElement {
  return (
    <div className="flex flex-col gap-5">
      <Descriptions
        column={1}
        size="small"
        items={[
          { key: 'email', label: 'Email', children: detail.email },
          {
            key: 'role',
            label: 'Role',
            children: <Tag>{ROLE_LABELS[detail.role] ?? detail.role}</Tag>,
          },
          { key: 'status', label: 'Status', children: <StatusBadge status={detail.status} /> },
          {
            key: 'verified',
            label: 'Verification',
            children: detail.verified ? 'Verified' : 'Unverified',
          },
          {
            key: 'visibility',
            label: 'Visibility',
            children: detail.isPrivate ? 'Private' : 'Public',
          },
          { key: 'bio', label: 'Bio', children: detail.profile.bio ?? '—' },
          { key: 'location', label: 'Location', children: detail.profile.location ?? '—' },
          { key: 'website', label: 'Website', children: detail.profile.websiteUrl ?? '—' },
          { key: 'joined', label: 'Joined', children: formatDate(detail.createdAt) },
          {
            key: 'lastLogin',
            label: 'Last login',
            children: detail.lastLoginAt === null ? '—' : formatDateTime(detail.lastLoginAt),
          },
        ]}
      />
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">Moderation</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Reports" value={formatCount(detail.moderation.reports)} />
          <StatCard label="Warnings" value={formatCount(detail.moderation.warnings)} />
          <StatCard label="Status changes" value={formatCount(detail.moderation.statusChanges)} />
        </div>
        <p className="text-xs text-ink-muted">
          Reports and warnings require the moderation module (not yet built) — shown as 0.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">Recent admin activity</h3>
        {auditList(detail.recentActivity.slice(0, 8), 'No admin actions recorded yet.')}
      </section>
    </div>
  );
}

function Statistics({ detail }: { detail: AdminUserDetail }): ReactElement {
  const s = detail.statistics;
  const tiles: Array<[string, number]> = [
    ['Views', s.views],
    ['Reads', s.reads],
    ['Followers', s.followers],
    ['Following', s.following],
    ['Published', s.publishedPieces],
    ['Drafts', s.drafts],
    ['Comments', s.comments],
    ['Bookmarks', s.bookmarks],
    ['Claps', s.claps],
    ['Responses', s.responses],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map(([label, value]) => (
        <StatCard key={label} label={label} value={formatCount(value)} />
      ))}
    </div>
  );
}

function ActivityTab({ userId, active }: { userId: string; active: boolean }): ReactElement {
  const query = useUserActivity(userId, active);
  if (query.isLoading) {
    return <LoadingState variant="rows" rows={5} />;
  }
  if (query.isError) {
    return <p className="text-sm text-danger">{getErrorMessage(query.error)}</p>;
  }
  const data = query.data;
  if (data === undefined) {
    return <EmptyState title="No activity" />;
  }
  return (
    <div className="flex flex-col gap-5 text-sm">
      <section className="flex flex-col gap-1">
        <h3 className="font-semibold text-ink">Recent logins</h3>
        {data.recentLogins.length === 0 ? (
          <p className="text-ink-muted">No login recorded.</p>
        ) : (
          data.recentLogins.map((login) => <div key={login.at}>{formatDateTime(login.at)}</div>)
        )}
      </section>
      <section className="flex flex-col gap-1">
        <h3 className="font-semibold text-ink">Publishing</h3>
        <div>
          {formatCount(data.publishing.publishedPieces ?? 0)} published ·{' '}
          {formatCount(data.publishing.drafts ?? 0)} drafts
        </div>
      </section>
      <section className="flex flex-col gap-1">
        <h3 className="font-semibold text-ink">Moderation events</h3>
        {auditList(data.moderationActivity, 'None.')}
      </section>
      <section className="flex flex-col gap-1">
        <h3 className="font-semibold text-ink">Account events</h3>
        {auditList(data.accountEvents, 'None.')}
      </section>
      <p className="text-xs text-ink-muted">{data.note}</p>
    </div>
  );
}

function LoginHistoryTab({ userId, active }: { userId: string; active: boolean }): ReactElement {
  const query = useUserLoginHistory(userId, active);
  if (query.isLoading) {
    return <LoadingState variant="rows" rows={3} />;
  }
  if (query.isError) {
    return <p className="text-sm text-danger">{getErrorMessage(query.error)}</p>;
  }
  const data = query.data;
  if (data === undefined) {
    return <EmptyState title="No login history" />;
  }
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div>
        <span className="text-ink-secondary">Last login: </span>
        {data.lastLoginAt === null ? '—' : formatDateTime(data.lastLoginAt)}
      </div>
      {data.successfulLogins.map((login) => (
        <div key={login.at}>{formatDateTime(login.at)}</div>
      ))}
      <p className="text-xs text-ink-muted">{data.note}</p>
    </div>
  );
}

/** The user detail drawer — a tabbed read-only profile, statistics, activity, audit + login views. */
export function UserDetailDrawer({ user, onClose, onEdit }: UserDetailDrawerProps): ReactElement {
  const { can } = usePermissions();
  const [tab, setTab] = useState('overview');
  const detail = useUser(user?.id ?? null);

  let body: ReactNode;
  if (user === null) {
    body = null;
  } else if (detail.isLoading) {
    body = <LoadingState variant="rows" rows={8} />;
  } else if (detail.isError) {
    body = <p className="text-sm text-danger">{getErrorMessage(detail.error)}</p>;
  } else if (detail.data !== undefined) {
    const data = detail.data;
    body = (
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'overview', label: 'Overview', children: <Overview detail={data} /> },
          { key: 'statistics', label: 'Statistics', children: <Statistics detail={data} /> },
          {
            key: 'activity',
            label: 'Activity',
            children: <ActivityTab userId={data.id} active={tab === 'activity'} />,
          },
          {
            key: 'audit',
            label: 'Audit',
            children: <UserAuditTab userId={data.id} active={tab === 'audit'} />,
          },
          {
            key: 'login',
            label: 'Login history',
            children: <LoginHistoryTab userId={data.id} active={tab === 'login'} />,
          },
        ]}
      />
    );
  }

  return (
    <Drawer
      open={user !== null}
      onClose={onClose}
      width={640}
      title={
        user === null ? null : (
          <div className="flex items-center justify-between gap-3">
            <span>@{user.username}</span>
            {can(PERMISSIONS.UserUpdate) ? (
              <QButton variant="secondary" size="sm" icon={Pencil} onClick={onEdit}>
                Edit
              </QButton>
            ) : null}
          </div>
        )
      }
    >
      {body}
    </Drawer>
  );
}
