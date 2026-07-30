import { QSkeleton } from '@qalam/ui';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link, useParams } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { formatCount, formatDate, formatDateTime } from '@/lib/format';
import { piecePath, ROUTES } from '@/lib/routes';

import { AnalyticsCard } from '../components/analytics-card';
import { AnalyticsError } from '../components/analytics-states';
import { BarChart } from '../components/charts/bar-chart';
import { DonutChart } from '../components/charts/donut-chart';
import { ExportMenu } from '../components/export-menu';
import { MetricCard } from '../components/metric-card';
import { usePieceAnalytics, usePieceMeta } from '../hooks/use-piece-analytics';
import type { ExportRow } from '../lib/export-analytics';
import { formatDurationShort, formatPercent } from '../lib/format-metrics';
import type { PieceAnalytics } from '../types/analytics.types';

function exportRows(a: PieceAnalytics): ExportRow[] {
  return [
    { metric: 'Views', value: a.views },
    { metric: 'Unique views', value: a.uniqueViews },
    { metric: 'Reads', value: a.reads },
    { metric: 'Completion rate', value: formatPercent(a.completionRate) },
    { metric: 'Average reading time (seconds)', value: a.averageReadTimeSeconds },
    { metric: 'Claps', value: a.claps },
    { metric: 'Comments', value: a.comments },
    { metric: 'Bookmarks', value: a.bookmarks },
    { metric: 'Responses', value: a.responses },
    { metric: 'Shares', value: a.shares },
    { metric: 'Source: in-app', value: a.readingSources.internal },
    { metric: 'Source: external', value: a.readingSources.external },
    { metric: 'Source: copied link', value: a.readingSources.copyLink },
  ];
}

/**
 * Per-piece analytics (`/me/stats/pieces/:id`, docs/06 §3.10 "piece-detail stats view"). Pairs the
 * owner-only `/analytics/pieces/:id` metrics with the piece meta (`/pieces/:id`) for its title +
 * "Last updated". Overview tiles + a reading-sources donut (share channels — the only "traffic
 * sources" `v1` exposes) + an engagement bar chart. 403/404 surface an honest error.
 */
export function PieceAnalyticsPage(): ReactElement {
  const { id = '' } = useParams();
  const analytics = usePieceAnalytics(id);
  const meta = usePieceMeta(id);
  usePageTitle(meta.data ? `Stats — ${meta.data.title}` : 'Piece stats');

  const a = analytics.data;

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <Link
          to={ROUTES.stats}
          className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink"
        >
          <ArrowLeft size={16} strokeWidth={1.75} className="rtl:rotate-180" aria-hidden />
          Back to your stats
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {meta.isLoading ? (
            <QSkeleton variant="title" width={240} />
          ) : (
            <h1 dir="auto" className="font-serif text-2xl font-semibold text-ink">
              {meta.data?.title || 'Untitled'}
            </h1>
          )}
          {meta.data ? (
            <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-ink-muted">
              {meta.data.publishedAt ? (
                <span>Published {formatDate(meta.data.publishedAt)}</span>
              ) : null}
              <span>Last updated {formatDateTime(meta.data.updatedAt)}</span>
              {meta.data.slug || meta.data.status === 'published' ? (
                <Link
                  to={piecePath(meta.data.slug ?? id)}
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  View piece
                  <ExternalLink size={13} strokeWidth={1.75} aria-hidden />
                </Link>
              ) : null}
            </p>
          ) : null}
        </div>
        {a ? <ExportMenu rows={exportRows(a)} json={a} filenameBase={`qalam-piece-${id}`} /> : null}
      </header>

      {analytics.isError ? (
        <AnalyticsError
          error={analytics.error}
          onRetry={() => {
            void analytics.refetch();
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <MetricCard
              label="Views"
              value={a ? formatCount(a.views) : ''}
              loading={analytics.isLoading}
            />
            <MetricCard
              label="Unique views"
              value={a ? formatCount(a.uniqueViews) : ''}
              loading={analytics.isLoading}
            />
            <MetricCard
              label="Reads"
              value={a ? formatCount(a.reads) : ''}
              loading={analytics.isLoading}
            />
            <MetricCard
              label="Completion"
              value={a ? formatPercent(a.completionRate) : ''}
              hint="Completed reads ÷ views."
              loading={analytics.isLoading}
            />
            <MetricCard
              label="Avg. read time"
              value={a ? formatDurationShort(a.averageReadTimeSeconds) : ''}
              loading={analytics.isLoading}
            />
            <MetricCard
              label="Claps"
              value={a ? formatCount(a.claps) : ''}
              loading={analytics.isLoading}
            />
            <MetricCard
              label="Comments"
              value={a ? formatCount(a.comments) : ''}
              loading={analytics.isLoading}
            />
            <MetricCard
              label="Bookmarks"
              value={a ? formatCount(a.bookmarks) : ''}
              loading={analytics.isLoading}
            />
            <MetricCard
              label="Responses"
              value={a ? formatCount(a.responses) : ''}
              loading={analytics.isLoading}
            />
            <MetricCard
              label="Shares"
              value={a ? formatCount(a.shares) : ''}
              loading={analytics.isLoading}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AnalyticsCard title="Reading sources" description="How readers reached this piece.">
              <DonutChart
                ariaLabel="Reading sources by share channel"
                loading={analytics.isLoading}
                items={
                  a
                    ? [
                        { name: 'In-app', value: a.readingSources.internal },
                        { name: 'External', value: a.readingSources.external },
                        { name: 'Copied link', value: a.readingSources.copyLink },
                      ]
                    : []
                }
                valueFormatter={formatCount}
                height={260}
              />
            </AnalyticsCard>

            <AnalyticsCard title="Engagement">
              <BarChart
                ariaLabel="Engagement counts for this piece"
                loading={analytics.isLoading}
                categories={['Claps', 'Comments', 'Bookmarks', 'Responses', 'Shares']}
                values={a ? [a.claps, a.comments, a.bookmarks, a.responses, a.shares] : []}
                valueFormatter={formatCount}
                height={220}
              />
            </AnalyticsCard>
          </div>
        </>
      )}
    </div>
  );
}
