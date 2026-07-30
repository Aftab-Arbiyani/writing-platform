import type { ReactElement } from 'react';

import { formatCount } from '@/lib/format';

import { formatDurationLong } from '../lib/format-metrics';
import type { ReaderAnalytics } from '../types/analytics.types';
import { AnalyticsCard } from './analytics-card';
import { BarChart } from './charts/bar-chart';
import { MetricCard } from './metric-card';

/**
 * Reader Insights (docs: the prompt's Reader Insights) — the user's OWN reading habits from
 * `/analytics/readers/me` (via the combined dashboard): pieces read, reading time, streaks, and the
 * genres/languages they read most. This is distinct from audience data (who reads THEM), which the
 * `v1` aggregates don't track — so no geography/device breakdown is shown (never fabricated).
 */
export function ReaderInsights({
  reader,
  loading = false,
}: {
  reader?: ReaderAnalytics;
  loading?: boolean;
}): ReactElement {
  const tiles = reader
    ? [
        { label: 'Pieces read', value: formatCount(reader.piecesRead) },
        { label: 'Reading time', value: formatDurationLong(reader.readingTimeSeconds) },
        { label: 'Completed reads', value: formatCount(reader.completedReads) },
        { label: 'Current streak', value: `${formatCount(reader.currentStreak)}d` },
        { label: 'Longest streak', value: `${formatCount(reader.longestStreak)}d` },
      ]
    : [];

  return (
    <AnalyticsCard
      title="Your reading"
      description="How you read on Qalam — your streaks and favourite genres."
    >
      {loading || !reader ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <MetricCard key={i} label="" value="" loading />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {tiles.map((t) => (
              <MetricCard key={t.label} label={t.label} value={t.value} />
            ))}
          </div>

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
        </>
      )}
    </AnalyticsCard>
  );
}
