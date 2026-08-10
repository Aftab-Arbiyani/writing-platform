import { QButton } from '@qalam/ui';
import { BarChart3 } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';

import { AnalyticsError } from '../components/analytics-states';
import { ExportMenu } from '../components/export-menu';
import { ReaderInsights } from '../components/reader-insights';
import { useMyBookmarksCount, useReaderAnalytics } from '../hooks/use-reader-analytics';
import { readerExportRows } from '../lib/export-analytics';

/**
 * **Your reading** (`/me/reading`) — the READER's own stats (W7c, [45 §4.4] row 4). A reader
 * surface, reached from the account menu beside their collections; the writer dashboard lives at
 * `/me/stats` and measures a different thing for a different audience, so the two are named and
 * described distinctly and each links to the other rather than duplicating it.
 *
 * One `GET /analytics/readers/me` read feeds every figure, plus a secondary bounded bookmarks
 * count. Three states, all honest:
 *   • **populated / all-zero** — a new reader's zeroes are TRUE (they really have read nothing),
 *     so they render. This page is never hidden for being empty; that is the whole point of
 *     splitting it out of a dashboard that hid behind "no published pieces".
 *   • **error** — the read is auth-gated and can fail. It says so and offers a retry. It does NOT
 *     fall back to zeroes: mobile degrades to local device history here, web has none ([48 §4]),
 *     and a fabricated zero is indistinguishable from a real one.
 *
 * Lazy route module (dynamic-imported); ECharts is code-split inside `BarChart`.
 */
export function ReadingStatsPage(): ReactElement {
  usePageTitle('Your reading');
  const navigate = useNavigate();
  const reader = useReaderAnalytics();
  const bookmarks = useMyBookmarksCount();

  // The bookmarks count is an augmentation on a separate endpoint: if it fails, its tile is simply
  // absent rather than shown as `0`, and the seven real aggregate figures still render.
  const bookmarksCount = bookmarks.data;

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Your reading</h1>
          <p className="text-sm text-ink-secondary">
            What you have read on Qalam — updated nightly. Only you can see this.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* The sibling surface, named for its audience so the two are never confused. */}
          <QButton
            variant="ghost"
            size="sm"
            icon={BarChart3}
            onClick={() => {
              void navigate(ROUTES.stats);
            }}
          >
            Your writing’s stats
          </QButton>
          {reader.data ? (
            <ExportMenu
              rows={readerExportRows(reader.data, bookmarksCount)}
              json={{ reader: reader.data, bookmarks: bookmarksCount }}
              filenameBase="qalam-reading"
            />
          ) : null}
        </div>
      </header>

      {reader.isError ? (
        <AnalyticsError
          error={reader.error}
          onRetry={() => {
            void reader.refetch();
          }}
        />
      ) : (
        // Loading renders the same component in its skeleton state; an all-zero payload renders
        // its real zeroes. Neither is an empty state, because neither is missing data.
        <ReaderInsights
          reader={reader.data}
          bookmarks={bookmarksCount}
          loading={reader.isLoading}
        />
      )}
    </div>
  );
}
