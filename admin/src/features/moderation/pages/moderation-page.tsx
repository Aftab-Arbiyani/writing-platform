import { Tabs } from 'antd';
import type { ReactElement } from 'react';
import { useSearchParams } from 'react-router';

import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { usePageTitle } from '@/hooks/use-page-title';

import { AppealsView } from '../components/appeals-view';
import { ReportsView } from '../components/reports-view';

/**
 * Content Moderation (A5). Two URL-driven tabs — Report queue and Appeals. Only
 * the active view is mounted, so each owns the URL list params (page/filters/sort)
 * without clashing; switching tabs starts the other view clean.
 */
export function ModerationPage(): ReactElement {
  usePageTitle('Moderation');
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'appeals' ? 'appeals' : 'reports';

  const setTab = (key: string): void => {
    const next = new URLSearchParams();
    if (key === 'appeals') {
      next.set('tab', 'appeals');
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
        ]}
      />
      {tab === 'appeals' ? <AppealsView /> : <ReportsView />}
    </PageContainer>
  );
}
