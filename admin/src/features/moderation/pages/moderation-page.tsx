import { Tabs } from 'antd';
import type { ReactElement } from 'react';
import { useSearchParams } from 'react-router';

import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { usePageTitle } from '@/hooks/use-page-title';

import { AppealsView } from '../components/appeals-view';
import { ReportStatistics } from '../components/report-statistics';
import { ReportsView } from '../components/reports-view';

type ModerationTab = 'reports' | 'appeals' | 'statistics';

function resolveTab(value: string | null): ModerationTab {
  return value === 'appeals' || value === 'statistics' ? value : 'reports';
}

/**
 * Content Moderation (A5 + A6). URL-driven tabs — Report queue, Appeals, and
 * Statistics. Only the active view is mounted, so each owns the URL list params
 * (page/filters/sort) without clashing; switching tabs starts the other clean.
 */
export function ModerationPage(): ReactElement {
  usePageTitle('Moderation');
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = resolveTab(searchParams.get('tab'));

  const setTab = (key: string): void => {
    const next = new URLSearchParams();
    if (key === 'appeals' || key === 'statistics') {
      next.set('tab', key);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <PageContainer>
      <PageHeader title="Moderation" description="Reports, content actions, and appeals." />
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'reports', label: 'Report queue' },
          { key: 'appeals', label: 'Appeals' },
          { key: 'statistics', label: 'Statistics' },
        ]}
      />
      {tab === 'appeals' && <AppealsView />}
      {tab === 'statistics' && <ReportStatistics />}
      {tab === 'reports' && <ReportsView />}
    </PageContainer>
  );
}
