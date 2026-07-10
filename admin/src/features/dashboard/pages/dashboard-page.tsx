import type { ReactElement } from 'react';

import { AppBreadcrumbs } from '@/components/app-breadcrumbs';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { usePageTitle } from '@/hooks/use-page-title';

import { ActivityWidget } from '../components/activity-widget';
import { AlertsWidget } from '../components/alerts-widget';
import { ModerationWidget } from '../components/moderation-widget';
import { OverviewWidget } from '../components/overview-widget';
import { QuickActionsWidget } from '../components/quick-actions-widget';
import { SystemHealthWidget } from '../components/system-health-widget';
import { TimeRangeFilter } from '../components/time-range-filter';

/**
 * The admin dashboard (docs/10 §3.4). Each widget owns its own query → independent caching, parallel
 * loading, and per-widget loading/error/empty states (one failing widget never blanks the page).
 * Widgets are memoized. Desktop-first two-column widget grid collapses to one column on tablet/mobile.
 */
export function DashboardPage(): ReactElement {
  usePageTitle('Dashboard');

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Platform health, growth, and moderation at a glance."
        breadcrumbs={<AppBreadcrumbs />}
        actions={<TimeRangeFilter />}
      />

      <OverviewWidget />
      <QuickActionsWidget />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SystemHealthWidget />
        <AlertsWidget />
        <ActivityWidget />
        <ModerationWidget />
      </div>
    </PageContainer>
  );
}
