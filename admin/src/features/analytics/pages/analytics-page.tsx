import { useToast } from '@qalam/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs } from 'antd';
import { lazy, Suspense, useState, type ReactElement } from 'react';
import { useSearchParams } from 'react-router';

import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage } from '@/lib/errors';
import { qk } from '@/lib/query-keys';

import { downloadAnalyticsExport } from '../api/analytics.api';
import { ANALYTICS_SECTIONS, DEFAULT_SECTION, RANGE_OPTIONS } from '../analytics.constants';
import { AnalyticsFilterBar } from '../components/analytics-filter-bar';
import { AnalyticsSkeleton } from '../components/analytics-skeleton';
import { useAnalyticsFilterValues } from '../stores/analytics-filters.store';
import type { AnalyticsDataset } from '../types/analytics.types';

// Lazy-load each section so its charts + ECharts land in on-demand chunks.
const OverviewSection = lazy(() =>
  import('../sections/overview-section').then((m) => ({ default: m.OverviewSection })),
);
const UsersSection = lazy(() =>
  import('../sections/users-section').then((m) => ({ default: m.UsersSection })),
);
const ContentSection = lazy(() =>
  import('../sections/content-section').then((m) => ({ default: m.ContentSection })),
);
const EngagementSection = lazy(() =>
  import('../sections/engagement-section').then((m) => ({ default: m.EngagementSection })),
);
const ModerationSection = lazy(() =>
  import('../sections/moderation-section').then((m) => ({ default: m.ModerationSection })),
);
const SystemSection = lazy(() =>
  import('../sections/system-section').then((m) => ({ default: m.SystemSection })),
);

/** Isolates the dashboard content when printing (a print-friendly view; no PDF). */
const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  #analytics-print, #analytics-print * { visibility: visible !important; }
  #analytics-print { position: absolute; inset-inline-start: 0; top: 0; width: 100%; }
}`;

function resolveSection(value: string | null): AnalyticsDataset {
  return ANALYTICS_SECTIONS.some((s) => s.key === value)
    ? (value as AnalyticsDataset)
    : DEFAULT_SECTION;
}

/**
 * Platform Analytics dashboard (A8) — platform-wide insights for admins (distinct
 * from the F9 writer dashboard). URL-driven section tabs, a persisted filter bar,
 * per-section lazy loading (charts/ECharts on demand), CSV/JSON export, and a
 * print-friendly view. Admin-only (route-gated on the Admin floor).
 */
export function AnalyticsPage(): ReactElement {
  usePageTitle('Analytics');
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useAnalyticsFilterValues();
  const toast = useToast();
  const queryClient = useQueryClient();

  const section = resolveSection(searchParams.get('section'));
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const setSection = (key: string): void => {
    const next = new URLSearchParams(searchParams);
    if (key === DEFAULT_SECTION) next.delete('section');
    else next.set('section', key);
    setSearchParams(next, { replace: true });
  };

  const onExport = (format: 'csv' | 'json'): void => {
    setExporting(true);
    downloadAnalyticsExport(filters, section, format)
      .catch((error: unknown) => toast.error(getErrorMessage(error)))
      .finally(() => setExporting(false));
  };

  const onRefresh = (): void => {
    setRefreshing(true);
    void queryClient
      .invalidateQueries({ queryKey: qk.analytics.all })
      .finally(() => setTimeout(() => setRefreshing(false), 400));
  };

  const rangeLabel = RANGE_OPTIONS.find((r) => r.value === filters.range)?.label ?? filters.range;

  return (
    <PageContainer>
      <style>{PRINT_CSS}</style>
      <PageHeader title="Analytics" description="Platform-wide insights." />

      <AnalyticsFilterBar
        onExport={onExport}
        exporting={exporting}
        onPrint={() => window.print()}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />

      <Tabs
        activeKey={section}
        onChange={setSection}
        items={ANALYTICS_SECTIONS.map((s) => ({ key: s.key, label: s.label }))}
      />

      <div id="analytics-print">
        {/* Heading between the page h1 and the chart h3s (heading hierarchy, WCAG 1.3.1). */}
        <h2 className="sr-only">
          {ANALYTICS_SECTIONS.find((s) => s.key === section)?.label ?? 'Overview'} analytics
        </h2>
        <p className="mb-4 hidden text-sm text-ink-secondary print:block">
          Qalam platform analytics — {rangeLabel}
        </p>
        <Suspense fallback={<AnalyticsSkeleton />}>
          {section === 'overview' && <OverviewSection filters={filters} />}
          {section === 'users' && <UsersSection filters={filters} />}
          {section === 'content' && <ContentSection filters={filters} />}
          {section === 'engagement' && <EngagementSection filters={filters} />}
          {section === 'moderation' && <ModerationSection filters={filters} />}
          {section === 'system' && <SystemSection />}
        </Suspense>
      </div>
    </PageContainer>
  );
}
