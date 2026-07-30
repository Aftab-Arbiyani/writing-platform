import { QButton, useToast } from '@qalam/ui';
import { Input, Select, Switch, Table, Tag, type TableColumnsType } from 'antd';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';

import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { EmptyState } from '@/components/empty-state';
import { LoadingState } from '@/components/loading-state';
import { getErrorMessage } from '@/lib/errors';

import {
  useDeleteFeatureFlag,
  useFeatureFlags,
  useUpdateFeatureFlag,
} from '../hooks/use-feature-flags';
import { ENVIRONMENT_OPTIONS } from '../settings.constants';
import type { FeatureFlag } from '../types/settings.types';
import { ConfigurationCard } from './configuration-card';
import { FeatureFlagDialog } from './feature-flag-dialog';

const ENV_COLOR: Record<string, string> = {
  all: 'blue',
  production: 'red',
  staging: 'gold',
  development: 'green',
};

const STATUS_OPTIONS = [
  { label: 'All statuses', value: 'all' },
  { label: 'Enabled', value: 'enabled' },
  { label: 'Disabled', value: 'disabled' },
];

/**
 * Feature Flag management (A7) — searchable, filterable table with an inline
 * enable/disable toggle (optimistic), plus create / edit / delete. Environment-
 * aware (column + filter). Integrates with `/admin/feature-flags`.
 */
export function FeatureFlagTable(): ReactElement {
  const toast = useToast();
  const query = useFeatureFlags();
  const toggle = useUpdateFeatureFlag();
  const remove = useDeleteFeatureFlag();

  const [search, setSearch] = useState('');
  const [environment, setEnvironment] = useState('all');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState<FeatureFlag | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<FeatureFlag | null>(null);

  const flags = useMemo(() => query.data ?? [], [query.data]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return flags.filter((flag) => {
      if (environment !== 'all' && flag.environment !== environment) return false;
      if (status === 'enabled' && !flag.enabled) return false;
      if (status === 'disabled' && flag.enabled) return false;
      if (term !== '' && !`${flag.key} ${flag.description}`.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });
  }, [flags, search, environment, status]);

  const onToggle = (flag: FeatureFlag, enabled: boolean): void => {
    toggle.mutate(
      { id: flag.id, payload: { enabled } },
      { onError: (error) => toast.error(getErrorMessage(error)) },
    );
  };

  const onConfirmDelete = (): void => {
    if (deleting === null) return;
    remove.mutate(
      { id: deleting.id },
      {
        onSuccess: () => {
          toast.success('Flag deleted.');
          setDeleting(null);
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  const columns: TableColumnsType<FeatureFlag> = [
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      width: 90,
      render: (_value, flag) => (
        <Switch
          checked={flag.enabled}
          onChange={(checked) => onToggle(flag, checked)}
          aria-label={`Toggle ${flag.key}`}
        />
      ),
    },
    {
      title: 'Key',
      dataIndex: 'key',
      render: (_value, flag) => (
        <div className="flex flex-col">
          <span className="font-mono text-sm text-ink">{flag.key}</span>
          {flag.description !== '' ? (
            <span className="text-xs text-ink-muted">{flag.description}</span>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Environment',
      dataIndex: 'environment',
      width: 140,
      render: (value: string) => <Tag color={ENV_COLOR[value] ?? 'default'}>{value}</Tag>,
    },
    {
      title: 'Rollout',
      dataIndex: 'rolloutPercentage',
      width: 100,
      render: (value: number) => <span className="tabular-nums">{value}%</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_value, flag) => (
        <div className="flex items-center gap-1">
          <QButton
            variant="ghost"
            size="sm"
            icon={Pencil}
            aria-label={`Edit ${flag.key}`}
            onClick={() => setEditing(flag)}
          />
          <QButton
            variant="ghost"
            size="sm"
            icon={Trash2}
            aria-label={`Delete ${flag.key}`}
            onClick={() => setDeleting(flag)}
          />
        </div>
      ),
    },
  ];

  if (query.isLoading) {
    return <LoadingState variant="rows" rows={5} />;
  }
  if (query.isError) {
    return (
      <EmptyState
        title="Couldn’t load feature flags"
        description={getErrorMessage(query.error)}
        action={
          <QButton variant="secondary" size="sm" onClick={() => void query.refetch()}>
            Retry
          </QButton>
        }
      />
    );
  }

  return (
    <ConfigurationCard
      title="Feature flags"
      description="Dark-launch and gradually roll out platform capabilities."
      actions={
        <QButton variant="primary" size="sm" icon={Plus} onClick={() => setCreating(true)}>
          New flag
        </QButton>
      }
    >
      <div className="flex flex-col gap-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input.Search
            allowClear
            placeholder="Search key or description…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="max-w-xs"
            aria-label="Search feature flags"
          />
          <Select
            value={environment}
            onChange={setEnvironment}
            options={[{ label: 'All environments', value: 'all' }, ...ENVIRONMENT_OPTIONS.slice(1)]}
            style={{ minWidth: 170 }}
            aria-label="Filter by environment"
          />
          <Select
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
            style={{ minWidth: 140 }}
            aria-label="Filter by status"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title={flags.length === 0 ? 'No feature flags' : 'No flags match these filters'}
            description={
              flags.length === 0
                ? 'Create a flag to dark-launch a capability.'
                : 'Try clearing a filter.'
            }
          />
        ) : (
          <Table<FeatureFlag>
            rowKey="id"
            columns={columns}
            dataSource={filtered}
            pagination={filtered.length > 10 ? { pageSize: 10, size: 'small' } : false}
            size="middle"
          />
        )}
      </div>

      <FeatureFlagDialog flag={null} open={creating} onClose={() => setCreating(false)} />
      <FeatureFlagDialog flag={editing} open={editing !== null} onClose={() => setEditing(null)} />
      <ConfirmationDialog
        open={deleting !== null}
        danger
        title="Delete feature flag?"
        message={`Delete "${deleting?.key}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={onConfirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </ConfigurationCard>
  );
}
