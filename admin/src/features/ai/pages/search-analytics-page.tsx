import {
  PERMISSIONS,
  RETRIEVAL_CONFIG_BOUNDS,
  SEARCH_ANALYTICS_DEFAULT_WINDOW_DAYS,
} from '@qalam/shared';
import { QCard, QSectionHeader } from '@qalam/ui';
import { Alert, Select } from 'antd';
import { Activity, Gauge, Search, Timer, TriangleAlert, Zap } from 'lucide-react';
import { useState } from 'react';
import type { ReactElement } from 'react';

import { AccessDenied } from '@/components/access-denied';
import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { usePageTitle } from '@/hooks/use-page-title';
import { usePermissions } from '@/hooks/use-permissions';

import { AsyncSection } from '../components/async-section';
import { useSearchAnalytics } from '../hooks/use-ai';
import {
  asPercent,
  EMPTY_COPY,
  FAILURE_LABELS,
  INTENT_LABELS,
  QUERY_TYPE_LABELS,
  searchAnalyticsIsEmpty,
} from '../lib/retrieval-labels';

/** Windows an operator actually asks for, inside the route's 1..90 day bound. */
const WINDOW_OPTIONS = [
  { value: 1, label: 'Last 24 hours' },
  { value: SEARCH_ANALYTICS_DEFAULT_WINDOW_DAYS, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: RETRIEVAL_CONFIG_BOUNDS.analyticsWindowDays.max, label: 'Last 90 days' },
] as const;

/** One counted breakdown row — count, share of the sample, and a proportional bar. */
function BreakdownRow({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}): ReactElement {
  const share = total > 0 ? count / total : 0;
  return (
    <li className="flex flex-col gap-1 py-3">
      <span className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span className="text-sm text-ink">{label}</span>
        <span className="text-sm font-semibold text-ink [font-variant-numeric:tabular-nums]">
          {count.toLocaleString()}{' '}
          <span className="font-normal text-ink-muted">({asPercent(share)})</span>
        </span>
      </span>
      {/* Decorative: the figure beside it is the accessible one, so the bar is hidden from AT. */}
      <span className="h-1.5 w-full overflow-hidden rounded-full bg-raised" aria-hidden>
        <span className="block h-full rounded-full bg-accent" style={{ width: asPercent(share) }} />
      </span>
    </li>
  );
}

/**
 * Search analytics (A3) — internal retrieval quality signals over a trailing window:
 * `GET /admin/ai/search-analytics`. Gated on `ai.manage`, and never surfaced to end users.
 *
 * **Two honesty rules drive this page.**
 *
 * A window with no requests renders as an ABSENCE, not a page of zeroes: every figure derives from
 * the same rows, so on an empty window they are all a true zero, and an operator cannot tell that
 * from a collapse in quality (the W7c defect, and the A1c precedent).
 *
 * And when the server reports `truncated`, the figures describe only the newest slice of the
 * window — the aggregation is capped server-side. That is stated in a banner rather than left to
 * an operator to infer from a suspiciously round query count, which is the only reason the flag
 * was added to the contract (A3-1).
 */
export function SearchAnalyticsPage(): ReactElement {
  usePageTitle('Search analytics');
  const { can } = usePermissions();
  const [windowDays, setWindowDays] = useState<number>(SEARCH_ANALYTICS_DEFAULT_WINDOW_DAYS);
  const query = useSearchAnalytics(windowDays);
  const analytics = query.data;

  if (!can(PERMISSIONS.AiManage)) {
    return <AccessDenied />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Search analytics"
        description="Quality signals for AI search, Ask My Book and recommendations, aggregated from request telemetry. Internal only — never shown to readers or writers."
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">Window</span>
          <Select
            value={windowDays}
            onChange={(value: number) => setWindowDays(value)}
            options={WINDOW_OPTIONS.map((option) => ({ ...option }))}
            aria-label="Analytics window"
            className="min-w-44"
          />
        </label>
      </div>

      <AsyncSection
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        loadingRows={5}
      >
        {analytics ? (
          searchAnalyticsIsEmpty(analytics) ? (
            <EmptyState
              icon={Search}
              title={EMPTY_COPY.title}
              description={EMPTY_COPY.description}
              minHeight={260}
            />
          ) : (
            <div className="flex flex-col gap-6">
              {analytics.truncated ? (
                <Alert
                  type="warning"
                  showIcon
                  message="These figures are a sample, not the whole window"
                  description={`The window held more requests than the server aggregates at once, so every figure below describes the most recent ${analytics.totalQueries.toLocaleString()} requests. Narrow the window for a complete picture.`}
                  data-testid="truncation-notice"
                />
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  label="Requests"
                  value={analytics.totalQueries.toLocaleString()}
                  icon={Search}
                  hint={`Logged in the last ${analytics.window}`}
                />
                <StatCard
                  label="Zero-result rate"
                  value={asPercent(analytics.zeroResultRate)}
                  icon={TriangleAlert}
                  hint="Requests that returned nothing"
                />
                <StatCard
                  label="Avg confidence"
                  value={analytics.avgConfidence.toFixed(2)}
                  icon={Gauge}
                  hint="0 to 1, across the sample"
                />
                <StatCard
                  label="Avg latency"
                  value={`${analytics.avgLatencyMs.toLocaleString()} ms`}
                  icon={Timer}
                  hint="End to end, including any model call"
                />
                <StatCard
                  label="p95 latency"
                  value={`${analytics.p95LatencyMs.toLocaleString()} ms`}
                  icon={Activity}
                  hint="The slow tail operators feel"
                />
                <StatCard
                  label="Cache hit ratio"
                  value={asPercent(analytics.cacheHitRatio)}
                  icon={Zap}
                  hint={`Avg context ${analytics.avgContextTokens.toLocaleString()} tokens`}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <QCard
                  as="section"
                  padding="lg"
                  className="flex flex-col gap-4"
                  data-testid="by-intent"
                >
                  <QSectionHeader
                    title="By intent"
                    description="Which retrieval surface the request came from."
                  />
                  <ul className="flex flex-col divide-y divide-line">
                    {analytics.byIntent.map((row) => (
                      <BreakdownRow
                        key={row.intent}
                        label={INTENT_LABELS[row.intent] ?? row.intent}
                        count={row.count}
                        total={analytics.totalQueries}
                      />
                    ))}
                  </ul>
                </QCard>

                <QCard
                  as="section"
                  padding="lg"
                  className="flex flex-col gap-4"
                  data-testid="by-query-type"
                >
                  <QSectionHeader
                    title="By query type"
                    description="What the classifier decided each query was about."
                  />
                  <ul className="flex flex-col divide-y divide-line">
                    {analytics.byQueryType.map((row) => (
                      <BreakdownRow
                        key={row.queryType}
                        label={QUERY_TYPE_LABELS[row.queryType] ?? row.queryType}
                        count={row.count}
                        total={analytics.totalQueries}
                      />
                    ))}
                  </ul>
                </QCard>
              </div>

              <QCard
                as="section"
                padding="lg"
                className="flex flex-col gap-4"
                data-testid="failures"
              >
                <QSectionHeader
                  title="Failures"
                  description="Only the requests that ended in a classified failure appear here."
                />
                {analytics.failureBreakdown.length === 0 ? (
                  <p className="text-sm text-ink-muted">
                    No classified failures in this window &mdash; every request completed.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line">
                    {analytics.failureBreakdown.map((row) => (
                      <BreakdownRow
                        key={row.reason}
                        label={FAILURE_LABELS[row.reason] ?? row.reason}
                        count={row.count}
                        total={analytics.totalQueries}
                      />
                    ))}
                  </ul>
                )}
              </QCard>

              <QCard as="section" padding="lg" className="flex flex-col gap-2">
                <QSectionHeader title="Reading these figures" />
                <p className="text-sm text-ink-secondary">
                  A <strong>zero-result</strong> request is one that returned no ranked results
                  &mdash; it is not an error, and it is the figure to watch when readers say search
                  finds nothing.
                </p>
                <p className="text-sm text-ink-secondary">
                  <strong>Confidence</strong> is the pipeline&apos;s own estimate, averaged over the
                  sample. It moves with how much evidence a request found, so a fall in it usually
                  precedes complaints about answer quality.
                </p>
                <p className="text-sm text-ink-secondary">
                  Percentages are shares of the requests in this window, so they answer &ldquo;how
                  much of our traffic&rdquo;, not &ldquo;how many users&rdquo;.
                </p>
              </QCard>
            </div>
          )
        ) : null}
      </AsyncSection>
    </PageContainer>
  );
}
