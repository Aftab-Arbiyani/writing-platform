import { QSkeleton } from '@qalam/ui';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { formatCount } from '@/lib/format';
import { feedPath, piecePath } from '@/lib/routes';

import { useAnalyticsTrending } from '../hooks/use-trending';
import type { RankedItem } from '../types/analytics.types';
import { AnalyticsCard } from './analytics-card';

function RankedList({
  items,
  href,
}: {
  items: RankedItem[];
  href: (item: RankedItem) => string;
}): ReactElement {
  return (
    <ol className="flex flex-col gap-1">
      {items.slice(0, 5).map((item, i) => (
        <li key={item.key}>
          <Link
            to={href(item)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-raised"
          >
            <span className="w-4 shrink-0 text-xs font-semibold tabular-nums text-ink-muted">
              {String(i + 1)}
            </span>
            <span dir="auto" className="min-w-0 flex-1 truncate text-ink">
              {item.label}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-ink-muted">
              {formatCount(item.count)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/**
 * "Trending on Qalam" (docs: Performance Trends context) — the platform-wide trending pieces +
 * genres from `/analytics/trending` (public). Context for the writer, not their own numbers. Hides
 * a group when it's empty; the whole card is skipped by the page when nothing is trending.
 */
export function TrendingSection(): ReactElement {
  const { data, isLoading } = useAnalyticsTrending();

  return (
    <AnalyticsCard title="Trending on Qalam" description="What readers are drawn to right now.">
      {isLoading ? (
        <QSkeleton variant="text" lines={5} />
      ) : (
        <div className="flex flex-col gap-5">
          {data && data.pieces.length > 0 ? (
            <section aria-labelledby="trend-pieces">
              <h3
                id="trend-pieces"
                className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted"
              >
                Pieces
              </h3>
              <RankedList items={data.pieces} href={(it) => piecePath(it.key)} />
            </section>
          ) : null}
          {data && data.genres.length > 0 ? (
            <section aria-labelledby="trend-genres">
              <h3
                id="trend-genres"
                className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted"
              >
                Genres
              </h3>
              <RankedList
                items={data.genres}
                href={(it) => feedPath({ tab: 'latest', genre: it.key })}
              />
            </section>
          ) : null}
          {!data || (data.pieces.length === 0 && data.genres.length === 0) ? (
            <p className="text-sm text-ink-muted">Nothing trending right now.</p>
          ) : null}
        </div>
      )}
    </AnalyticsCard>
  );
}
