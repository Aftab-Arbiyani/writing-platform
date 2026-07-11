import type { ReactElement } from 'react';

import { DashboardGrid } from '@/components/dashboard-grid';
import { StatCard } from '@/components/stat-card';
import { formatCount } from '@/lib/format';

import { BarChart } from '../charts/bar-chart';
import { ChartContainer } from '../charts/chart-container';
import { LineChart } from '../charts/line-chart';
import { DonutChart } from '../charts/pie-chart';
import { formatSeconds } from '../analytics.constants';
import { AnalyticsCard } from '../components/analytics-card';
import { RankedList } from '../components/ranked-list';
import { SectionState } from '../components/section-state';
import { useModerationAnalytics, useModerationTrends } from '../hooks/use-analytics';
import type { AnalyticsFilters } from '../types/analytics.types';

/** Moderation Analytics — reports, appeals, resolution, trends, moderator activity. */
export function ModerationSection({ filters }: { filters: AnalyticsFilters }): ReactElement {
  const query = useModerationAnalytics(filters);
  const trends = useModerationTrends();
  const data = query.data;
  const points = trends.data?.points ?? [];

  return (
    <SectionState
      loading={query.isLoading}
      error={query.isError ? query.error : null}
      onRetry={() => void query.refetch()}
    >
      {data !== undefined ? (
        <div className="flex flex-col gap-6">
          <DashboardGrid>
            <StatCard label="Open reports" value={formatCount(data.openReports)} />
            <StatCard label="Closed reports" value={formatCount(data.closedReports)} />
            <StatCard label="Appeals" value={formatCount(data.appeals)} />
            <StatCard
              label="Avg resolution time"
              value={formatSeconds(data.averageResolutionSeconds)}
            />
          </DashboardGrid>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartContainer
              title="Open vs closed"
              isEmpty={data.openReports + data.closedReports === 0}
              table={{
                columns: ['Status', 'Count'],
                rows: [
                  ['Open', data.openReports],
                  ['Closed', data.closedReports],
                ],
              }}
            >
              <DonutChart
                ariaLabel="Open vs closed reports"
                data={[
                  { name: 'Open', value: data.openReports },
                  { name: 'Closed', value: data.closedReports },
                ]}
              />
            </ChartContainer>

            <ChartContainer
              title="Moderation trends"
              loading={trends.isLoading}
              isEmpty={points.length === 0}
              table={{
                columns: ['Date', 'Created', 'Resolved'],
                rows: points.map((p) => [p.date, p.created, p.resolved]),
              }}
            >
              <LineChart
                ariaLabel="Reports created vs resolved over time"
                showLegend
                categories={points.map((p) => p.date)}
                series={[
                  { name: 'Created', data: points.map((p) => p.created) },
                  { name: 'Resolved', data: points.map((p) => p.resolved) },
                ]}
              />
            </ChartContainer>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartContainer
              title="Top report reasons"
              isEmpty={data.topReportReasons.length === 0}
              table={{
                columns: ['Reason', 'Count'],
                rows: data.topReportReasons.map((r) => [r.label, r.count]),
              }}
            >
              <BarChart
                ariaLabel="Top report reasons"
                horizontal
                categories={data.topReportReasons.map((r) => r.label)}
                data={data.topReportReasons.map((r) => r.count)}
              />
            </ChartContainer>

            <AnalyticsCard title="Moderator activity">
              <RankedList
                items={data.moderatorActivity}
                valueLabel="Resolved"
                emptyText="No resolutions yet."
              />
            </AnalyticsCard>
          </div>
        </div>
      ) : null}
    </SectionState>
  );
}
