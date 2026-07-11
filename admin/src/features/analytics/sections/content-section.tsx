import type { ReactElement } from 'react';

import { DashboardGrid } from '@/components/dashboard-grid';
import { StatCard } from '@/components/stat-card';
import { formatCount } from '@/lib/format';

import { BarChart } from '../charts/bar-chart';
import { ChartContainer } from '../charts/chart-container';
import { DonutChart } from '../charts/pie-chart';
import { formatRate, formatSeconds } from '../analytics.constants';
import { AnalyticsCard } from '../components/analytics-card';
import { RankedList } from '../components/ranked-list';
import { SectionState } from '../components/section-state';
import { useContentAnalytics, useTrending } from '../hooks/use-analytics';
import type { AnalyticsFilters } from '../types/analytics.types';

/** Content Analytics — pieces, breakdowns, reading, most read/shared, trending. */
export function ContentSection({ filters }: { filters: AnalyticsFilters }): ReactElement {
  const query = useContentAnalytics(filters);
  const trending = useTrending();
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
            <StatCard label="Published pieces" value={formatCount(data.publishedPieces)} />
            <StatCard label="Drafts" value={formatCount(data.drafts)} />
            <StatCard label="Avg reading time" value={formatSeconds(data.averageReadingSeconds)} />
            <StatCard label="Completion rate" value={formatRate(data.averageCompletionRate)} />
          </DashboardGrid>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartContainer
              title="Pieces by genre"
              isEmpty={data.piecesPerGenre.length === 0}
              table={{
                columns: ['Genre', 'Pieces'],
                rows: data.piecesPerGenre.map((g) => [g.label, g.count]),
              }}
            >
              <BarChart
                ariaLabel="Pieces by genre"
                categories={data.piecesPerGenre.map((g) => g.label)}
                data={data.piecesPerGenre.map((g) => g.count)}
              />
            </ChartContainer>

            <ChartContainer
              title="Pieces by language"
              isEmpty={data.piecesPerLanguage.length === 0}
              table={{
                columns: ['Language', 'Pieces'],
                rows: data.piecesPerLanguage.map((l) => [l.label, l.count]),
              }}
            >
              <DonutChart
                ariaLabel="Pieces by language"
                data={data.piecesPerLanguage.map((l) => ({ name: l.label, value: l.count }))}
              />
            </ChartContainer>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AnalyticsCard title="Most read">
              <RankedList items={data.mostViewedPieces} valueLabel="Views" />
            </AnalyticsCard>
            <AnalyticsCard title="Most shared">
              <RankedList items={data.mostSharedPieces} valueLabel="Shares" />
            </AnalyticsCard>
            <AnalyticsCard title="Trending writers">
              <RankedList
                items={trending.data?.writers ?? []}
                valueLabel="Views"
                emptyText={trending.isLoading ? 'Loading…' : 'No trending writers.'}
              />
            </AnalyticsCard>
            <AnalyticsCard title="Trending tags">
              <RankedList
                items={trending.data?.tags ?? []}
                valueLabel="Uses"
                emptyText={trending.isLoading ? 'Loading…' : 'No trending tags.'}
              />
            </AnalyticsCard>
          </div>
        </div>
      ) : null}
    </SectionState>
  );
}
