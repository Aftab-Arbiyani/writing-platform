import { QButton, QSkeleton } from '@qalam/ui';
import { ArrowRight } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { formatDate, formatReadingTime } from '@/lib/format';
import { pieceStatsPath } from '@/lib/routes';

import type { useMyPublishedPieces } from '../hooks/use-my-pieces';
import { AnalyticsCard } from './analytics-card';
import { AnalyticsError } from './analytics-states';

const VISIBILITY_LABEL: Record<string, string> = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Private',
};

/**
 * The writer's published pieces as an accessible `<table>` (docs: accessible tables). Each title
 * links to that piece's full analytics (`/me/stats/pieces/:id`) — the `/me/pieces` list carries
 * metadata only (no per-piece metrics), so the numbers live one click away rather than firing an
 * N+1 of per-piece analytics on the dashboard. Cursor-paginated ("Load more").
 */
export function PiecesTable({
  query,
}: {
  query: ReturnType<typeof useMyPublishedPieces>;
}): ReactElement {
  const pieces = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <AnalyticsCard title="Your pieces" description="Open a piece to see its full analytics.">
      {query.isError ? (
        <AnalyticsError error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <div aria-hidden className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <QSkeleton key={i} variant="text" lines={1} />
          ))}
        </div>
      ) : pieces.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">No published pieces yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Your published pieces and links to their analytics
              </caption>
              <thead>
                <tr className="border-line border-b text-start text-xs uppercase tracking-wide text-ink-muted">
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    Title
                  </th>
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    Published
                  </th>
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    Reading time
                  </th>
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    Visibility
                  </th>
                  <th scope="col" className="py-2 text-end font-medium">
                    <span className="sr-only">Analytics</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pieces.map((piece) => (
                  <tr key={piece.id} className="border-line border-b last:border-0">
                    <th
                      scope="row"
                      className="max-w-[20ch] truncate py-3 pe-3 text-start font-normal"
                    >
                      <Link
                        to={pieceStatsPath(piece.id)}
                        dir="auto"
                        className="font-medium text-ink hover:text-accent hover:underline"
                      >
                        {piece.title || 'Untitled'}
                      </Link>
                    </th>
                    <td className="whitespace-nowrap py-3 pe-3 text-ink-secondary">
                      {piece.publishedAt ? formatDate(piece.publishedAt) : '—'}
                    </td>
                    <td className="whitespace-nowrap py-3 pe-3 text-ink-secondary tabular-nums">
                      {formatReadingTime(piece.readingTimeSeconds)}
                    </td>
                    <td className="py-3 pe-3 text-ink-secondary">
                      {VISIBILITY_LABEL[piece.visibility] ?? piece.visibility}
                    </td>
                    <td className="py-3 text-end">
                      <Link
                        to={pieceStatsPath(piece.id)}
                        aria-label={`Analytics for ${piece.title || 'Untitled'}`}
                        className="inline-flex items-center gap-1 text-accent hover:underline"
                      >
                        Stats
                        <ArrowRight
                          size={14}
                          strokeWidth={1.75}
                          className="rtl:rotate-180"
                          aria-hidden
                        />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {query.hasNextPage ? (
            <div className="flex justify-center pt-2">
              <QButton
                variant="secondary"
                size="sm"
                loading={query.isFetchingNextPage}
                onClick={() => {
                  void query.fetchNextPage();
                }}
              >
                Load more
              </QButton>
            </div>
          ) : null}
        </>
      )}
    </AnalyticsCard>
  );
}
