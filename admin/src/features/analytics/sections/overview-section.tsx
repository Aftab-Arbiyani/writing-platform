import type { ReactElement } from 'react';

import { DashboardGrid } from '@/components/dashboard-grid';
import { MetricCard } from '@/components/metric-card';
import { StatCard } from '@/components/stat-card';
import { formatCount } from '@/lib/format';

import { BarChart } from '../charts/bar-chart';
import { ChartContainer } from '../charts/chart-container';
import { DonutChart } from '../charts/pie-chart';
import { formatBytes } from '../analytics.constants';
import { useOverview, useUserAnalytics } from '../hooks/use-analytics';
import type { AnalyticsFilters } from '../types/analytics.types';
import { SectionState } from '../components/section-state';

/** Platform Overview — headline counts + growth, active-users trio, content/engagement mix. */
export function OverviewSection({ filters }: { filters: AnalyticsFilters }): ReactElement {
  const overview = useOverview(filters);
  const users = useUserAnalytics(filters); // parallel query for DAU/WAU/MAU

  const data = overview.data;
  const growth = data?.growthRatePct ?? 0;

  return (
    <SectionState
      loading={overview.isLoading}
      error={overview.isError ? overview.error : null}
      onRetry={() => void overview.refetch()}
    >
      {data !== undefined ? (
        <div className="flex flex-col gap-6">
          <DashboardGrid>
            <StatCard label="Total users" value={formatCount(data.totalUsers)} />
            <StatCard label="Verified users" value={formatCount(data.verifiedUsers)} />
            <StatCard label="Active users (30d)" value={formatCount(data.activeUsers)} />
            <MetricCard
              label="New registrations"
              value={formatCount(data.newUsers)}
              delta={`${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`}
              direction={growth > 0 ? 'up' : growth < 0 ? 'down' : 'flat'}
              description="vs previous period"
            />
            {users.data !== undefined ? (
              <>
                <StatCard label="Daily active" value={formatCount(users.data.dailyActiveUsers)} />
                <StatCard label="Weekly active" value={formatCount(users.data.weeklyActiveUsers)} />
                <StatCard
                  label="Monthly active"
                  value={formatCount(users.data.monthlyActiveUsers)}
                />
              </>
            ) : null}
            <StatCard label="Published pieces" value={formatCount(data.publishedPieces)} />
            <StatCard label="Drafts" value={formatCount(data.drafts)} />
            <StatCard label="Comments" value={formatCount(data.comments)} />
            <StatCard label="Responses" value={formatCount(data.responses)} />
            <StatCard label="Bookmarks" value={formatCount(data.bookmarks)} />
            <StatCard label="Claps" value={formatCount(data.claps)} />
            <StatCard
              label="Reports"
              value={formatCount(data.reports)}
              hint={`${formatCount(data.resolvedReports)} resolved`}
            />
            <StatCard label="Followers" value={formatCount(data.followers)} />
            <StatCard
              label="Storage (database)"
              value={formatBytes(data.databaseSizeBytes)}
              hint="Object storage not tracked"
            />
          </DashboardGrid>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartContainer
              title="Content mix"
              isEmpty={data.publishedPieces + data.drafts === 0}
              table={{
                columns: ['Type', 'Count'],
                rows: [
                  ['Published', data.publishedPieces],
                  ['Drafts', data.drafts],
                ],
              }}
            >
              <DonutChart
                ariaLabel="Published vs draft pieces"
                data={[
                  { name: 'Published', value: data.publishedPieces },
                  { name: 'Drafts', value: data.drafts },
                ]}
              />
            </ChartContainer>

            <ChartContainer
              title="Engagement"
              table={{
                columns: ['Type', 'Count'],
                rows: [
                  ['Comments', data.comments],
                  ['Responses', data.responses],
                  ['Bookmarks', data.bookmarks],
                  ['Claps', data.claps],
                ],
              }}
            >
              <BarChart
                ariaLabel="Engagement totals"
                categories={['Comments', 'Responses', 'Bookmarks', 'Claps']}
                data={[data.comments, data.responses, data.bookmarks, data.claps]}
              />
            </ChartContainer>
          </div>
        </div>
      ) : null}
    </SectionState>
  );
}
