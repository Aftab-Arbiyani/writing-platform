import { QCard, QTag } from '@qalam/ui';
import { Activity, CircleCheck, Hourglass, ShieldCheck, Siren, Timer } from 'lucide-react';
import type { ReactElement } from 'react';

import { DashboardGrid } from '@/components/dashboard-grid';
import { EnvBadge } from '@/components/env-badge';
import { HealthStatusCard } from '@/components/health-status-card';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { usePageTitle } from '@/hooks/use-page-title';
import { formatCount, formatPercent } from '@/lib/format';

import { AsyncSection } from '../components/async-section';
import { OperationalHealthBadge } from '../components/operations-badges';
import { componentStatusLabel, componentStatusToHealth } from '../components/operations-status';
import { useOperationsHealth, useReliability } from '../hooks/use-operations';
import type { ComponentCategory, HealthComponent } from '../types/operations.types';

/** Category display order + label for the grouped operational-health grid. */
const CATEGORY_META: Array<{ key: ComponentCategory; label: string }> = [
  { key: 'service', label: 'Services' },
  { key: 'dependency', label: 'Dependencies' },
  { key: 'infrastructure', label: 'Infrastructure' },
  { key: 'worker', label: 'Workers' },
  { key: 'third_party', label: 'Third-party' },
];

function componentsFor(
  components: HealthComponent[],
  category: ComponentCategory,
): HealthComponent[] {
  return components.filter((component) => component.category === category);
}

/**
 * Service Status (P7.4) — the operational-health components grouped by category with the overall
 * roll-up, plus the reliability KPIs (availability, MTTR, MTBF, incident resolution, recovery
 * verification) and a failures-by-class breakdown. Read-only, admin-gated, auto-refreshing.
 */
export function ServiceStatusDashboardPage(): ReactElement {
  usePageTitle('Service status');
  const healthQuery = useOperationsHealth();
  const reliabilityQuery = useReliability();

  const health = healthQuery.data;
  const reliability = reliabilityQuery.data;

  const failureClasses = reliability ? Object.entries(reliability.failuresByClass) : [];

  return (
    <PageContainer>
      <PageHeader
        title="Service status"
        description="Component health by category and the platform's reliability KPIs."
        actions={
          <div className="flex items-center gap-2">
            {health ? <OperationalHealthBadge health={health.overall} size="md" /> : null}
            <EnvBadge />
          </div>
        }
      />

      {/* Reliability KPIs. */}
      <AsyncSection
        isLoading={reliabilityQuery.isLoading}
        error={reliabilityQuery.error}
        onRetry={() => void reliabilityQuery.refetch()}
        loadingRows={4}
      >
        {reliability ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard
                label="Availability"
                value={formatPercent(reliability.availabilityRatio)}
                icon={Activity}
                hint={`Over the last ${formatCount(reliability.windowDays)} days`}
              />
              <StatCard
                label="MTTR"
                value={
                  reliability.mttrMinutes === null
                    ? '—'
                    : `${formatCount(reliability.mttrMinutes)} min`
                }
                icon={Timer}
                hint="Mean time to resolve"
              />
              <StatCard
                label="MTBF"
                value={
                  reliability.mtbfHours === null ? '—' : `${formatCount(reliability.mtbfHours)} h`
                }
                icon={Hourglass}
                hint="Mean time between failures"
              />
              <StatCard
                label="Incidents resolved"
                value={`${formatCount(reliability.incidentsResolved)}/${formatCount(reliability.incidentsTotal)}`}
                icon={Siren}
                hint="Resolved / total in window"
              />
              <StatCard
                label="Recovery verified"
                value={formatPercent(reliability.recoveryVerifiedRate)}
                icon={ShieldCheck}
                hint="Recoveries confirmed"
              />
            </div>

            {failureClasses.length > 0 ? (
              <QCard as="section" padding="lg" className="flex flex-col gap-3">
                <h2 className="text-base font-semibold text-ink">Failures by class</h2>
                <ul className="flex flex-wrap gap-2">
                  {failureClasses.map(([failureClass, count]) => (
                    <li key={failureClass}>
                      <QTag color="neutral" size="md">
                        {failureClass}: {formatCount(count)}
                      </QTag>
                    </li>
                  ))}
                </ul>
              </QCard>
            ) : null}
          </div>
        ) : null}
      </AsyncSection>

      {/* Operational-health components grouped by category. */}
      <QCard as="section" padding="lg" className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <CircleCheck size={18} strokeWidth={1.75} className="text-ink-secondary" aria-hidden />
            <h2 className="text-base font-semibold text-ink">Component health</h2>
          </div>
          {health ? <p className="text-sm text-ink-secondary">{health.statusSummary}</p> : null}
        </div>
        <AsyncSection
          isLoading={healthQuery.isLoading}
          error={healthQuery.error}
          onRetry={() => void healthQuery.refetch()}
          loadingRows={6}
        >
          {health ? (
            <div className="flex flex-col gap-6">
              {CATEGORY_META.map(({ key, label }) => {
                const items = componentsFor(health.components, key);
                if (items.length === 0) return null;
                return (
                  <section key={key} className="flex flex-col gap-3">
                    <h3 className="text-sm font-medium text-ink-secondary">{label}</h3>
                    <DashboardGrid minColWidth={220}>
                      {items.map((component) => (
                        <HealthStatusCard
                          key={component.name}
                          name={component.name}
                          status={componentStatusToHealth(component.status)}
                          detail={component.detail || componentStatusLabel(component.status)}
                        />
                      ))}
                    </DashboardGrid>
                  </section>
                );
              })}
            </div>
          ) : null}
        </AsyncSection>
      </QCard>
    </PageContainer>
  );
}
