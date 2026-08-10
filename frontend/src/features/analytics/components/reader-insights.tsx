import type { ReactElement } from 'react';

import { formatCount } from '@/lib/format';

import { formatDurationLong } from '../lib/format-metrics';
import type { BoundedCount, ReaderAnalytics } from '../types/analytics.types';
import { AnalyticsCard } from './analytics-card';
import { BarChart } from './charts/bar-chart';
import { MetricCard } from './metric-card';

/**
 * Reader Insights — the reader's OWN reading aggregate from `GET /analytics/readers/me`: pieces
 * read, reading time, completed reads, both streaks, and the genres/languages they read most.
 * Distinct from audience data (who reads THEM), which `v1` does not track — so no geography or
 * device breakdown is shown, ever fabricated.
 *
 * **Its only home is `/me/reading`** (W7c). Until then it rendered as a section of the WRITER
 * dashboard, which sent a reader who had never published to a page about their writing; the move
 * is the row ([45 §4.4] row 4). Two cards rather than one so the page's `h1` is not shadowed by an
 * identically-named `h2`.
 *
 * Three cards mobile renders here are deliberately absent — Continue Reading, Recently Read and
 * Weekly Activity all derive from DEVICE reading history, which web has no store for and is not
 * getting ([48 §4]). Their absence is recorded, not silent.
 *
 * Every number here is a TRUE zero for a new reader, so zeroes render rather than hiding the page.
 * The one figure that cannot be exact is `bookmarks`: it is a bounded count, shown as `50+` when
 * more exist, and omitted entirely when its (separate, independently-failing) read did not land.
 */
export function ReaderInsights({
  reader,
  bookmarks,
  loading = false,
}: {
  reader?: ReaderAnalytics;
  bookmarks?: BoundedCount;
  loading?: boolean;
}): ReactElement {
  const tiles: { label: string; value: string; hint?: string }[] = reader
    ? [
        { label: 'Pieces read', value: formatCount(reader.piecesRead) },
        { label: 'Reading time', value: formatDurationLong(reader.readingTimeSeconds) },
        { label: 'Completed reads', value: formatCount(reader.completedReads) },
        { label: 'Current streak', value: `${formatCount(reader.currentStreak)}d` },
        { label: 'Longest streak', value: `${formatCount(reader.longestStreak)}d` },
        // A bounded count (one page of /me/bookmarks): `50+` when more exist, never a bare total.
        ...(bookmarks
          ? [
              {
                label: 'Bookmarks',
                value: `${formatCount(bookmarks.count)}${bookmarks.hasMore ? '+' : ''}`,
                hint: bookmarks.hasMore
                  ? 'At least this many — counted from your most recent bookmarks.'
                  : undefined,
              },
            ]
          : []),
      ]
    : [];

  if (loading || !reader) {
    return (
      <AnalyticsCard title="Reading habits">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <MetricCard key={i} label="" value="" loading />
          ))}
        </div>
      </AnalyticsCard>
    );
  }

  return (
    <>
      <AnalyticsCard
        title="Reading habits"
        description="Time spent, pieces finished, and how many days running you have read."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {tiles.map((t) => (
            <MetricCard key={t.label} label={t.label} value={t.value} hint={t.hint} />
          ))}
        </div>
      </AnalyticsCard>

      <AnalyticsCard
        title="What you read most"
        description="Your favourite genres and languages, ranked by how much of each you have read."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium text-ink-secondary">Favourite genres</h3>
            <BarChart
              ariaLabel="Your most-read genres"
              categories={reader.favoriteGenres.map((g) => g.label)}
              values={reader.favoriteGenres.map((g) => g.count)}
              valueFormatter={formatCount}
              height={Math.max(120, reader.favoriteGenres.length * 36)}
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-ink-secondary">Favourite languages</h3>
            <BarChart
              ariaLabel="Your most-read languages"
              categories={reader.favoriteLanguages.map((l) => l.label)}
              values={reader.favoriteLanguages.map((l) => l.count)}
              valueFormatter={formatCount}
              height={Math.max(120, reader.favoriteLanguages.length * 36)}
            />
          </div>
        </div>
      </AnalyticsCard>
    </>
  );
}
