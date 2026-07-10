import type { ReactElement } from 'react';

import { formatCount } from '@/lib/format';

import { deriveTrend, metricSeries } from '../lib/derive-trends';
import { formatDurationShort, formatPercent } from '../lib/format-metrics';
import type { GrowthPoint, WriterAnalytics } from '../types/analytics.types';
import { MetricCard } from './metric-card';

/** One overview tile spec; `growthKey` (when set) drives its trend badge + sparkline. */
interface Tile {
  label: string;
  value: string;
  hint?: string;
  growthKey?: string;
}

const READ_HINT = 'A read counts when a reader dwells 30s+ or scrolls 50%+.';

/**
 * The overview metric grid (docs/06 §3.10 tiles; the prompt's Overview Metrics). All-time writer
 * aggregates from `/analytics/dashboard`, the total follower count from the profile, and — where
 * the growth series has data — a trend badge + sparkline per tile. Metrics without a snapshot
 * series (rates, engagement received) simply show no trend (never a fabricated one). Tiles exceed
 * two columns by design (docs/06 §11 permits analytics tiles to).
 */
export function OverviewCards({
  writer,
  followers,
  growthPoints,
  loading = false,
}: {
  writer?: WriterAnalytics;
  followers?: number;
  growthPoints: GrowthPoint[];
  loading?: boolean;
}): ReactElement {
  if (loading || !writer) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <MetricCard key={i} label="" value="" loading />
        ))}
      </div>
    );
  }

  const tiles: Tile[] = [
    { label: 'Total views', value: formatCount(writer.totalViews), growthKey: 'views' },
    { label: 'Unique views', value: formatCount(writer.uniqueViews), growthKey: 'uniqueViews' },
    { label: 'Reads', value: formatCount(writer.reads), hint: READ_HINT, growthKey: 'reads' },
    {
      label: 'Completion rate',
      value: formatPercent(writer.completionRate),
      hint: 'Completed reads ÷ views.',
    },
    {
      label: 'Avg. reading time',
      value: formatDurationShort(writer.averageReadTimeSeconds),
      hint: 'Average time readers spend per read.',
    },
    ...(followers !== undefined ? [{ label: 'Followers', value: formatCount(followers) }] : []),
    {
      label: 'Followers gained',
      value: formatCount(writer.followersGained),
      growthKey: 'followersGained',
    },
    {
      label: 'Published pieces',
      value: formatCount(writer.piecesPublished),
      growthKey: 'piecesPublished',
    },
    { label: 'Comments', value: formatCount(writer.commentsReceived) },
    { label: 'Claps', value: formatCount(writer.clapsReceived) },
    { label: 'Bookmarks', value: formatCount(writer.bookmarksReceived) },
    { label: 'Responses', value: formatCount(writer.responsesReceived) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {tiles.map((tile) => {
        const trend = tile.growthKey ? deriveTrend(growthPoints, tile.growthKey) : null;
        const spark = tile.growthKey
          ? metricSeries(growthPoints, tile.growthKey).map(([, v]) => v)
          : undefined;
        return (
          <MetricCard
            key={tile.label}
            label={tile.label}
            value={tile.value}
            hint={tile.hint}
            trend={trend}
            spark={spark}
          />
        );
      })}
    </div>
  );
}
