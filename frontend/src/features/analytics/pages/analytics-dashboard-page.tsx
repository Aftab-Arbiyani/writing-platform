import type { ReactElement } from 'react';

import { usePageTitle } from '@/hooks/use-page-title';
import { useMe } from '@/hooks/use-me';

import { AnalyticsCard } from '../components/analytics-card';
import {
  AnalyticsError,
  DashboardSkeleton,
  NoPublishedPieces,
} from '../components/analytics-states';
import { ComparisonCard } from '../components/comparison-card';
import { ExportMenu } from '../components/export-menu';
import { GrowthSection } from '../components/growth-section';
import { OverviewCards } from '../components/overview-cards';
import { PiecesTable } from '../components/pieces-table';
import { ReaderInsights } from '../components/reader-insights';
import { TopPieceCard } from '../components/top-piece-card';
import { TrendingSection } from '../components/trending-section';
import { useDashboard } from '../hooks/use-dashboard';
import { useGrowth } from '../hooks/use-growth';
import { useMyPublishedPieces } from '../hooks/use-my-pieces';
import { formatPercent } from '../lib/format-metrics';
import type { ExportRow } from '../lib/export-analytics';
import type { ReaderAnalytics, WriterAnalytics } from '../types/analytics.types';

/** Assemble the CSV/JSON export rows from the fetched aggregates (docs: Export CSV/JSON). */
function buildExportRows(
  writer: WriterAnalytics,
  reader: ReaderAnalytics | undefined,
  followers: number | undefined,
): ExportRow[] {
  const rows: ExportRow[] = [
    { metric: 'Total views', value: writer.totalViews },
    { metric: 'Unique views', value: writer.uniqueViews },
    { metric: 'Reads', value: writer.reads },
    { metric: 'Completion rate', value: formatPercent(writer.completionRate) },
    { metric: 'Average reading time (seconds)', value: writer.averageReadTimeSeconds },
    ...(followers !== undefined ? [{ metric: 'Followers', value: followers }] : []),
    { metric: 'Followers gained', value: writer.followersGained },
    { metric: 'Published pieces', value: writer.piecesPublished },
    { metric: 'Comments received', value: writer.commentsReceived },
    { metric: 'Claps received', value: writer.clapsReceived },
    { metric: 'Bookmarks received', value: writer.bookmarksReceived },
    { metric: 'Responses received', value: writer.responsesReceived },
  ];
  if (reader) {
    rows.push(
      { metric: 'Pieces read', value: reader.piecesRead },
      { metric: 'Reading time (seconds)', value: reader.readingTimeSeconds },
      { metric: 'Current reading streak (days)', value: reader.currentStreak },
      { metric: 'Longest reading streak (days)', value: reader.longestStreak },
    );
  }
  return rows;
}

/**
 * The Writer Analytics dashboard (`/me/stats`, docs/06 §3.10). One `/analytics/dashboard` call
 * feeds the overview tiles + reader insights; growth + the pieces table + trending load alongside.
 * All numbers are real aggregates ("Updated nightly"); a writer with nothing published sees the
 * docs empty state (their reading stats still show). Lazy route module (dynamic-imported).
 */
export function AnalyticsDashboardPage(): ReactElement {
  usePageTitle('Your stats');
  const dashboard = useDashboard();
  const growth = useGrowth();
  const pieces = useMyPublishedPieces();
  const me = useMe();

  const writer = dashboard.data?.writer;
  const reader = dashboard.data?.reader;
  const followers = me.data?.counts.followers;
  const growthPoints = growth.data?.points ?? [];

  const hasPublished = (writer?.piecesPublished ?? 0) > 0;

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Your stats</h1>
          <p className="text-sm text-ink-secondary">
            Your writing’s reach on Qalam — updated nightly.
          </p>
        </div>
        {writer ? (
          <ExportMenu
            rows={buildExportRows(writer, reader, followers)}
            json={{ writer, reader, followers }}
            filenameBase="qalam-analytics"
          />
        ) : null}
      </header>

      {dashboard.isLoading ? (
        <DashboardSkeleton />
      ) : dashboard.isError ? (
        <AnalyticsError
          error={dashboard.error}
          onRetry={() => {
            void dashboard.refetch();
          }}
        />
      ) : writer && !hasPublished ? (
        <>
          <NoPublishedPieces />
          <ReaderInsights reader={reader} />
        </>
      ) : writer ? (
        <>
          <OverviewCards writer={writer} followers={followers} growthPoints={growthPoints} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex min-w-0 flex-col gap-6">
              <GrowthSection query={growth} />
              <PiecesTable query={pieces} />
            </div>

            <aside className="flex flex-col gap-6" aria-label="Highlights">
              {writer.mostPopularPiece ? <TopPieceCard piece={writer.mostPopularPiece} /> : null}
              <AnalyticsCard title="Views">
                <ComparisonCard
                  title="Unique vs. repeat"
                  primary={{ label: 'Unique', value: writer.uniqueViews }}
                  secondary={{
                    label: 'Repeat',
                    value: Math.max(0, writer.totalViews - writer.uniqueViews),
                  }}
                />
              </AnalyticsCard>
              <TrendingSection />
            </aside>
          </div>

          <ReaderInsights reader={reader} />
        </>
      ) : null}
    </div>
  );
}
