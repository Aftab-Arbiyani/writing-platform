import type { ReactElement } from 'react';

import { DashboardGrid } from '@/components/dashboard-grid';
import { StatCard } from '@/components/stat-card';
import { formatCount } from '@/lib/format';

import { AreaChart } from '../charts/line-chart';
import { BarChart } from '../charts/bar-chart';
import { ChartContainer } from '../charts/chart-container';
import { HeatmapChart } from '../charts/heatmap-chart';
import { AnalyticsCard } from '../components/analytics-card';
import { RankedList } from '../components/ranked-list';
import { SectionState } from '../components/section-state';
import { useUserAnalytics } from '../hooks/use-analytics';
import type { AnalyticsFilters } from '../types/analytics.types';

/** User Analytics — registrations trend, retention, DAU/WAU/MAU, breakdowns. */
export function UsersSection({ filters }: { filters: AnalyticsFilters }): ReactElement {
  const query = useUserAnalytics(filters);
  const data = query.data;

  return (
    <SectionState
      loading={query.isLoading}
      error={query.isError ? query.error : null}
      onRetry={() => void query.refetch()}
    >
      {data !== undefined ? (
        <div className="flex flex-col gap-6">
          <DashboardGrid>
            <StatCard label="Registrations" value={formatCount(data.registrations)} />
            <StatCard label="Active users (range)" value={formatCount(data.activeUsers)} />
            <StatCard
              label="Returning users"
              value={formatCount(Math.max(0, data.activeUsers - data.registrations))}
              hint="Active minus new (est.)"
            />
            <StatCard label="Retention" value={`${data.retentionPct.toFixed(1)}%`} />
            <StatCard label="Daily active" value={formatCount(data.dailyActiveUsers)} />
            <StatCard label="Weekly active" value={formatCount(data.weeklyActiveUsers)} />
            <StatCard label="Monthly active" value={formatCount(data.monthlyActiveUsers)} />
          </DashboardGrid>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartContainer
              title="Registrations over time"
              loading={query.isFetching && data.registrationsSeries.length === 0}
              isEmpty={data.registrationsSeries.length === 0}
              table={{
                columns: ['Date', 'Registrations'],
                rows: data.registrationsSeries.map((p) => [p.date, p.count]),
              }}
            >
              <AreaChart
                ariaLabel="Daily registrations"
                categories={data.registrationsSeries.map((p) => p.date)}
                series={[
                  { name: 'Registrations', data: data.registrationsSeries.map((p) => p.count) },
                ]}
              />
            </ChartContainer>

            <ChartContainer
              title="Registration heat map"
              isEmpty={data.registrationsSeries.length === 0}
              height={200}
            >
              <HeatmapChart
                ariaLabel="Registrations calendar heat map"
                height={200}
                data={data.registrationsSeries.map((p) => [p.date, p.count])}
              />
            </ChartContainer>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartContainer
              title="Top languages"
              isEmpty={data.topLanguages.length === 0}
              table={{
                columns: ['Language', 'Users'],
                rows: data.topLanguages.map((l) => [l.label, l.count]),
              }}
            >
              <BarChart
                ariaLabel="Top languages"
                horizontal
                categories={data.topLanguages.map((l) => l.label)}
                data={data.topLanguages.map((l) => l.count)}
              />
            </ChartContainer>

            <div className="grid gap-4 sm:grid-cols-3">
              <AnalyticsCard title="Top countries">
                <RankedList items={data.topCountries} emptyText="Geo isn’t captured yet." />
              </AnalyticsCard>
              <AnalyticsCard title="Top devices">
                <RankedList items={data.topDevices} emptyText="Device isn’t captured yet." />
              </AnalyticsCard>
              <AnalyticsCard title="Top browsers">
                <RankedList items={[]} emptyText="Browser isn’t captured yet." />
              </AnalyticsCard>
            </div>
          </div>
        </div>
      ) : null}
    </SectionState>
  );
}
