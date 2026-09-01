import { QCard } from '@qalam/ui';
import { Table, type TableColumnsType } from 'antd';
import { Fingerprint, Gauge, KeyRound, Lock, ShieldAlert, Timer, UserX } from 'lucide-react';
import type { ReactElement } from 'react';

import { EnvBadge } from '@/components/env-badge';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { usePageTitle } from '@/hooks/use-page-title';
import { formatCount } from '@/lib/format';

import { AsyncSection } from '@/components/async-section';
import { AuditLinkCard } from '../components/audit-link-card';
import { BoolIndicator } from '../components/bool-indicator';
import { ControlsPanel } from '../components/controls-panel';
import { useKeyStatuses, useSecurityStatus } from '../hooks/use-security';
import type { KeyStatus } from '../types/security.types';

const KEY_COLUMNS: TableColumnsType<KeyStatus> = [
  {
    title: 'Key ID',
    dataIndex: 'id',
    key: 'id',
    render: (id: string) => <span className="font-mono text-sm text-ink">{id}</span>,
  },
  {
    title: 'State',
    dataIndex: 'active',
    key: 'active',
    render: (active: boolean) => (
      <BoolIndicator value={active} trueLabel="Active" falseLabel="Standby" />
    ),
  },
  {
    title: 'Algorithm',
    dataIndex: 'algorithm',
    key: 'algorithm',
    render: (algorithm: string) => <span className="font-mono text-sm text-ink">{algorithm}</span>,
  },
  {
    title: 'Length',
    dataIndex: 'length',
    key: 'length',
    align: 'right',
    className: 'tabular-nums',
    render: (length: number) => `${formatCount(length)} bytes`,
  },
];

/**
 * Security Dashboard + Threat Dashboard + Security Event Viewer (P7.2). Read-only, admin-gated. Two
 * independent queries: the posture (`/admin/security/status`) drives the account-lockout + threat
 * thresholds tiles and the platform-controls panel; the key status (`/admin/security/keys`) drives
 * the encryption-key table. The security event feed is the existing Audit Logs browser filtered to
 * the `security` category — linked here, never re-implemented (docs P7.2).
 */
export function SecurityDashboardPage(): ReactElement {
  usePageTitle('Security dashboard');
  const statusQuery = useSecurityStatus();
  const keysQuery = useKeyStatuses();

  const status = statusQuery.data;
  const keys = keysQuery.data;

  return (
    <PageContainer>
      <PageHeader
        title="Security dashboard"
        description="Platform security posture, threat-detection thresholds, and encryption key status."
        actions={
          <div className="flex items-center gap-2">
            {status ? (
              <StatusBadge
                status={status.encryptionEnabled ? 'active' : 'inactive'}
                tone={status.encryptionEnabled ? 'success' : 'danger'}
                label={status.encryptionEnabled ? 'Encryption on' : 'Encryption off'}
                size="md"
              />
            ) : null}
            <EnvBadge />
          </div>
        }
      />

      <AsyncSection
        isLoading={statusQuery.isLoading}
        error={statusQuery.error}
        onRetry={() => void statusQuery.refetch()}
        loadingRows={6}
      >
        {status ? (
          <div className="flex flex-col gap-6">
            {/* Account lockout policy — stat tiles. */}
            <section className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-ink">Account lockout</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  label="Lockout"
                  value={status.lockout.enabled ? 'Enabled' : 'Disabled'}
                  icon={Lock}
                  hint={status.lockout.enabled ? 'Brute-force protection active' : 'Not enforced'}
                />
                <StatCard
                  label="Max attempts"
                  value={formatCount(status.lockout.maxAttempts)}
                  icon={UserX}
                  hint="Failed logins before lockout"
                />
                <StatCard
                  label="Lockout window"
                  value={`${formatCount(status.lockout.lockoutMinutes)} min`}
                  icon={Timer}
                  hint="Duration an account stays locked"
                />
              </div>
            </section>

            {/* Threat-detection thresholds — stat tiles. */}
            <section className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-ink">Threat-detection thresholds</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  label="Credential stuffing"
                  value={formatCount(status.threatThresholds.stuffingDistinctAccounts)}
                  icon={ShieldAlert}
                  hint="Distinct accounts per source"
                />
                <StatCard
                  label="Brute force"
                  value={formatCount(status.threatThresholds.bruteForceAttempts)}
                  icon={UserX}
                  hint="Attempts before flagging"
                />
                <StatCard
                  label="High-risk score"
                  value={formatCount(status.threatThresholds.highRiskScore)}
                  icon={Gauge}
                  hint="Risk score that triggers review"
                />
              </div>
            </section>

            {/* Active platform controls — badges. */}
            <ControlsPanel controls={status.controls} />
          </div>
        ) : null}
      </AsyncSection>

      {/* Encryption / key status. */}
      <QCard as="section" padding="lg" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <KeyRound size={18} strokeWidth={1.75} className="text-ink-secondary" aria-hidden />
            <h2 className="text-base font-semibold text-ink">Encryption keys</h2>
          </div>
          <p className="text-sm text-ink-secondary">
            Non-secret key status only — key material is never exposed.
            {keys
              ? ` Rotation policy: keys older than ${formatCount(keys.maxKeyAgeDays)} days should be rotated.`
              : ''}
          </p>
        </div>

        <AsyncSection
          isLoading={keysQuery.isLoading}
          error={keysQuery.error}
          onRetry={() => void keysQuery.refetch()}
          loadingRows={4}
        >
          {keys ? (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <StatCard
                  label="Encryption keys"
                  value={formatCount(keys.keys.length)}
                  icon={Fingerprint}
                  hint="Loaded key versions"
                />
                <StatCard
                  label="Max key age"
                  value={`${formatCount(keys.maxKeyAgeDays)} days`}
                  icon={Timer}
                  hint="Rotation threshold"
                />
              </div>
              <Table<KeyStatus>
                columns={KEY_COLUMNS}
                dataSource={keys.keys}
                rowKey="id"
                pagination={false}
                size="middle"
                sticky
                scroll={{ x: 'max-content' }}
              />
            </div>
          ) : null}
        </AsyncSection>
      </QCard>

      {/* Security event feed → the existing Audit Logs browser, filtered to `security`. */}
      <AuditLinkCard
        category="security"
        title="Security event viewer"
        description="Browse security-category events in the audit log."
      />
    </PageContainer>
  );
}
