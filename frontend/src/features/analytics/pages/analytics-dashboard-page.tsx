import { QButton } from '@qalam/ui';
import { BookOpen } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { useMe } from '@/hooks/use-me';
import { ROUTES } from '@/lib/routes';

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
import { TopPieceCard } from '../components/top-piece-card';
import { TrendingSection } from '../components/trending-section';
import { useDashboard } from '../hooks/use-dashboard';
import { useGrowth } from '../hooks/use-growth';
import { useMyPublishedPieces } from '../hooks/use-my-pieces';
import { writerExportRows } from '../lib/export-analytics';

/**
 * The Writer Analytics dashboard (`/me/stats`, docs/06 §3.10). One `/analytics/dashboard` call
 * feeds the overview tiles; growth + the pieces table + trending load alongside. All numbers are
 * real aggregates ("Updated nightly"); a writer with nothing published sees the docs empty state.
 * Lazy route module (dynamic-imported).
 *
 * A WRITER surface, and only that (W7c). The reader's own reading aggregate used to render here as
 * a `ReaderInsights` section — which meant the only way to see what you had READ was a page headed
 * "Your writing's reach". It now lives at `/me/reading`; this page links to it instead of carrying
 * it ([45 §4.4] row 4). `/analytics/dashboard` still returns `{writer, reader}` and this page still
 * calls it, because the writer half is what it needs — the reader half of that payload is simply
 * unused here.
 */
export function AnalyticsDashboardPage(): ReactElement {
  usePageTitle('Your stats');
  const navigate = useNavigate();
  const dashboard = useDashboard();
  const growth = useGrowth();
  const pieces = useMyPublishedPieces();
  const me = useMe();

  const writer = dashboard.data?.writer;
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
        <div className="flex flex-wrap items-center gap-2">
          {/* The sibling surface, named for its audience so the two are never confused. */}
          <QButton
            variant="ghost"
            size="sm"
            icon={BookOpen}
            onClick={() => {
              void navigate(ROUTES.reading);
            }}
          >
            Your reading
          </QButton>
          {writer ? (
            <ExportMenu
              rows={writerExportRows(writer, followers)}
              json={{ writer, followers }}
              filenameBase="qalam-analytics"
            />
          ) : null}
        </div>
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
        // Nothing published, so nothing to measure here. The header's "Your reading" link is the
        // route to figures this person DOES have — a reader with no writing is exactly who used to
        // be stranded on this page.
        <NoPublishedPieces />
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
        </>
      ) : null}
    </div>
  );
}
