import type { ReactElement } from 'react';

import { DashboardGrid } from '@/components/dashboard-grid';
import { StatCard } from '@/components/stat-card';
import { formatCount } from '@/lib/format';

import { BarChart } from '../charts/bar-chart';
import { ChartContainer } from '../charts/chart-container';
import { formatRate, formatSeconds } from '../analytics.constants';
import { SectionState } from '../components/section-state';
import { useEngagementAnalytics } from '../hooks/use-analytics';
import type { AnalyticsFilters } from '../types/analytics.types';

/** Engagement Analytics — interaction totals + follower growth. */
export function EngagementSection({ filters }: { filters: AnalyticsFilters }): ReactElement {
  const query = useEngagementAnalytics(filters);
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
            <StatCard label="Views" value={formatCount(data.views)} />
            <StatCard label="Reads" value={formatCount(data.reads)} />
            <StatCard label="Reading time" value={formatSeconds(data.readingSeconds)} />
            <StatCard label="Completion rate" value={formatRate(data.completionRate)} />
            <StatCard label="Bookmarks" value={formatCount(data.bookmarks)} />
            <StatCard label="Claps" value={formatCount(data.claps)} />
            <StatCard label="Comments" value={formatCount(data.comments)} />
            <StatCard label="Responses" value={formatCount(data.responses)} />
            <StatCard label="Shares" value={formatCount(data.shares)} />
            <StatCard label="Follower growth" value={formatCount(data.followersGrowth)} />
          </DashboardGrid>

          <ChartContainer
            title="Engagement breakdown"
            table={{
              columns: ['Type', 'Count'],
              rows: [
                ['Views', data.views],
                ['Reads', data.reads],
                ['Bookmarks', data.bookmarks],
                ['Claps', data.claps],
                ['Comments', data.comments],
                ['Responses', data.responses],
                ['Shares', data.shares],
              ],
            }}
          >
            <BarChart
              ariaLabel="Engagement breakdown"
              categories={[
                'Views',
                'Reads',
                'Bookmarks',
                'Claps',
                'Comments',
                'Responses',
                'Shares',
              ]}
              data={[
                data.views,
                data.reads,
                data.bookmarks,
                data.claps,
                data.comments,
                data.responses,
                data.shares,
              ]}
            />
          </ChartContainer>
        </div>
      ) : null}
    </SectionState>
  );
}
