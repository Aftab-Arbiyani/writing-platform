import { QButton, QCard, useToast } from '@qalam/ui';
import { InputNumber, Table, type TableColumnsType } from 'antd';
import { OctagonX, ToggleRight } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { getErrorMessage } from '@/lib/errors';

import { useKillRollout, useSetRolloutPercentage } from '../hooks/use-operations';
import type { Rollout } from '../types/operations.types';
import { AsyncSection } from './async-section';
import { BoolIndicator } from './bool-indicator';
import { RolloutStrategyBadge } from './operations-badges';

/** Editable percentage cell — draft state + a Set button (PATCH …/rollouts/:key/percentage). */
function PercentageCell({ rollout }: { rollout: Rollout }): ReactElement {
  const toast = useToast();
  const setPercentage = useSetRolloutPercentage();
  const [draft, setDraft] = useState<number>(rollout.rolloutPercentage);
  const dirty = draft !== rollout.rolloutPercentage;

  const apply = (): void => {
    setPercentage.mutate(
      { key: rollout.key, percentage: draft },
      {
        onSuccess: () => toast.success(`${rollout.key} set to ${draft}%.`),
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  return (
    <div className="flex items-center gap-2">
      <InputNumber
        size="small"
        value={draft}
        min={0}
        max={100}
        onChange={(value) => setDraft(typeof value === 'number' ? value : 0)}
        aria-label={`${rollout.key} rollout percentage`}
        style={{ width: 88 }}
        formatter={(value) => `${value ?? 0}%`}
        parser={(value) => Number((value ?? '').replace('%', ''))}
      />
      <QButton
        variant="secondary"
        size="sm"
        onClick={apply}
        loading={setPercentage.isPending}
        disabled={!dirty}
      >
        Set
      </QButton>
    </div>
  );
}

/** Kill-switch button — confirms, then POST …/rollouts/:key/kill. */
function KillButton({ rollout }: { rollout: Rollout }): ReactElement {
  const toast = useToast();
  const kill = useKillRollout();
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <QButton
        variant="danger"
        size="sm"
        icon={OctagonX}
        disabled={rollout.killSwitchEngaged}
        onClick={() => setConfirm(true)}
      >
        {rollout.killSwitchEngaged ? 'Killed' : 'Kill'}
      </QButton>
      <ConfirmationDialog
        open={confirm}
        danger
        title={`Engage kill switch for ${rollout.key}?`}
        message="This immediately disables the feature for all users. It can be re-enabled by setting a rollout percentage."
        confirmLabel="Engage kill switch"
        loading={kill.isPending}
        onConfirm={() => {
          kill.mutate(
            { key: rollout.key },
            {
              onSuccess: () => {
                toast.success(`Kill switch engaged for ${rollout.key}.`);
                setConfirm(false);
              },
              onError: (error) => {
                toast.error(getErrorMessage(error));
                setConfirm(false);
              },
            },
          );
        }}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

export interface RolloutsSectionProps {
  rollouts: Rollout[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  canManage: boolean;
}

/**
 * Feature-rollouts management (P7.4) — one row per flag with its strategy, environment, and state.
 * When the viewer holds `settings.manage`, the percentage becomes editable and a kill switch is
 * exposed (both re-checked server-side). Otherwise it's a read-only rollout register.
 */
export function RolloutsSection({
  rollouts,
  isLoading,
  error,
  onRetry,
  canManage,
}: RolloutsSectionProps): ReactElement {
  const columns: TableColumnsType<Rollout> = [
    {
      title: 'Flag',
      dataIndex: 'key',
      key: 'key',
      render: (key: string, rollout) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-sm text-ink">{key}</span>
          {rollout.description ? (
            <span className="text-xs text-ink-muted">{rollout.description}</span>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Strategy',
      dataIndex: 'strategy',
      key: 'strategy',
      render: (_, rollout) => <RolloutStrategyBadge strategy={rollout.strategy} />,
    },
    { title: 'Environment', dataIndex: 'environment', key: 'environment' },
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (
        <BoolIndicator value={enabled} trueLabel="Enabled" falseLabel="Disabled" />
      ),
    },
    {
      title: 'Kill switch',
      dataIndex: 'killSwitchEngaged',
      key: 'killSwitchEngaged',
      render: (engaged: boolean) => (
        <BoolIndicator
          value={engaged}
          trueLabel="Engaged"
          falseLabel="Off"
          trueStatus="critical"
          falseStatus="healthy"
        />
      ),
    },
    {
      title: 'Rollout',
      key: 'percentage',
      render: (_, rollout) =>
        canManage ? (
          <PercentageCell rollout={rollout} />
        ) : (
          <span className="tabular-nums text-ink">{rollout.rolloutPercentage}%</span>
        ),
    },
    ...(canManage
      ? [
          {
            title: '',
            key: 'actions',
            align: 'right' as const,
            render: (_: unknown, rollout: Rollout) => <KillButton rollout={rollout} />,
          },
        ]
      : []),
  ];

  return (
    <QCard as="section" padding="lg" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <ToggleRight size={18} strokeWidth={1.75} className="text-ink-secondary" aria-hidden />
        <h2 className="text-base font-semibold text-ink">Feature rollouts</h2>
      </div>
      <AsyncSection isLoading={isLoading} error={error} onRetry={onRetry} loadingRows={4}>
        <Table<Rollout>
          columns={columns}
          dataSource={rollouts ?? []}
          rowKey="key"
          pagination={false}
          size="middle"
          sticky
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'No feature rollouts configured.' }}
        />
      </AsyncSection>
    </QCard>
  );
}
