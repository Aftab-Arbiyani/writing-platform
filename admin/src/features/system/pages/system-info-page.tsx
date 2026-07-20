import { QTag, type QTagColor } from '@qalam/ui';
import { Boxes, Cpu, GitCommitHorizontal, Hammer, Rocket, Server, TimerReset } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { EnvBadge } from '@/components/env-badge';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { usePageTitle } from '@/hooks/use-page-title';
import { formatDateTime, formatDuration } from '@/lib/format';

import { AsyncSection } from '../components/async-section';
import { BoolIndicator } from '../components/bool-indicator';
import { DefinitionCard } from '../components/definition-card';
import { useSystemInfo, useVersion } from '../hooks/use-system';

/** Environment name → tone (prod is the one to be careful about, so it stands out). */
function environmentTone(environment: string): QTagColor {
  const normalized = environment.toLowerCase();
  if (normalized === 'production') return 'info';
  if (normalized === 'staging') return 'warning';
  return 'neutral';
}

/** Monospace, truncating value for hashes/ids (full string in the title attribute). */
function Mono({ value }: { value: string }): ReactElement {
  const text = value || '—';
  return (
    <span className="block truncate font-mono text-sm text-ink" title={text}>
      {text}
    </span>
  );
}

/** Absolute datetime, or an em-dash when the field is unset (dev builds leave some blank). */
function dateOrDash(value: string): ReactNode {
  return value ? formatDateTime(value) : '—';
}

/**
 * System Information (P7.1) — the deployment identity of the running instance: deployment &
 * environment status, build, release, runtime, and the public version endpoint. All read-only,
 * admin-gated. Headline tiles up top; grouped identity fields below in definition cards.
 */
export function SystemInfoPage(): ReactElement {
  usePageTitle('System information');
  const infoQuery = useSystemInfo();
  const versionQuery = useVersion();

  const info = infoQuery.data;
  const version = versionQuery.data;

  return (
    <PageContainer>
      <PageHeader
        title="System information"
        description="Deployment, build, release, and runtime identity of this instance."
        actions={<EnvBadge />}
      />

      <AsyncSection
        isLoading={infoQuery.isLoading}
        error={infoQuery.error}
        onRetry={() => void infoQuery.refetch()}
        loadingRows={6}
      >
        {info ? (
          <div className="flex flex-col gap-6">
            {/* Deployment / Environment status — headline tiles. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Service"
                value={info.service}
                icon={Server}
                hint={info.environment}
              />
              <StatCard
                label="Version"
                value={info.build.version}
                icon={Rocket}
                hint={`Release ${info.release.releaseTag || '—'}`}
              />
              <StatCard
                label="Uptime"
                value={formatDuration(info.runtime.uptimeSeconds)}
                icon={TimerReset}
                hint={`Since ${dateOrDash(info.runtime.startedAt)}`}
              />
              <StatCard
                label="Commit"
                value={info.build.commitShort || '—'}
                icon={GitCommitHorizontal}
                hint={info.release.channel}
              />
            </div>

            <DefinitionCard
              title="Deployment status"
              icon={Boxes}
              items={[
                { label: 'Service', value: info.service },
                {
                  label: 'Environment',
                  value: (
                    <QTag color={environmentTone(info.environment)} size="sm">
                      {info.environment}
                    </QTag>
                  ),
                },
                { label: 'Release channel', value: info.release.channel || '—' },
                { label: 'Deployed at', value: dateOrDash(info.release.deployedAt) },
              ]}
            />

            <DefinitionCard
              title="Build information"
              icon={Hammer}
              items={[
                { label: 'Version', value: info.build.version },
                { label: 'Build number', value: info.build.buildNumber || '—' },
                { label: 'Commit (short)', value: <Mono value={info.build.commitShort} /> },
                { label: 'Commit', value: <Mono value={info.build.commit} /> },
                { label: 'Build time', value: dateOrDash(info.build.buildTime) },
              ]}
            />

            <DefinitionCard
              title="Release information"
              icon={Rocket}
              items={[
                { label: 'Release channel', value: info.release.channel || '—' },
                { label: 'Release tag', value: info.release.releaseTag || '—' },
                { label: 'Deployed at', value: dateOrDash(info.release.deployedAt) },
              ]}
            />

            <DefinitionCard
              title="Runtime"
              icon={Cpu}
              items={[
                { label: 'Node version', value: <Mono value={info.runtime.nodeVersion} /> },
                { label: 'Instance ID', value: <Mono value={info.runtime.instanceId} /> },
                { label: 'PID', value: info.runtime.pid },
                { label: 'Uptime', value: formatDuration(info.runtime.uptimeSeconds) },
                { label: 'Started at', value: dateOrDash(info.runtime.startedAt) },
                {
                  label: 'Workers',
                  value: (
                    <BoolIndicator
                      value={info.runtime.workersEnabled}
                      trueLabel="Enabled"
                      falseLabel="Disabled"
                    />
                  ),
                },
                {
                  label: 'Scheduler',
                  value: (
                    <BoolIndicator
                      value={info.runtime.schedulerEnabled}
                      trueLabel="Enabled"
                      falseLabel="Disabled"
                    />
                  ),
                },
                { label: 'Config version', value: <Mono value={info.config.version} /> },
                { label: 'Config fingerprint', value: <Mono value={info.config.fingerprint} /> },
              ]}
            />

            {/* Version Information — the public /version probe (independent query). */}
            <AsyncSection
              isLoading={versionQuery.isLoading}
              error={versionQuery.error}
              onRetry={() => void versionQuery.refetch()}
              loadingRows={3}
            >
              {version ? (
                <DefinitionCard
                  title="Version information"
                  description="Public build identity from the root /version probe."
                  icon={GitCommitHorizontal}
                  items={[
                    { label: 'Service', value: version.service },
                    { label: 'Version', value: version.version },
                    { label: 'Commit', value: <Mono value={version.commit} /> },
                    { label: 'Environment', value: version.environment || '—' },
                    { label: 'Release channel', value: version.releaseChannel || '—' },
                  ]}
                />
              ) : (
                <DefinitionCard
                  title="Version information"
                  description="Public build identity from the root /version probe."
                  icon={GitCommitHorizontal}
                  items={[{ label: 'Status', value: 'Unavailable' }]}
                />
              )}
            </AsyncSection>
          </div>
        ) : null}
      </AsyncSection>
    </PageContainer>
  );
}
