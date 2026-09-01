import { QCard, type QTagColor } from '@qalam/ui';
import { Table, type TableColumnsType } from 'antd';
import { CalendarDays, CalendarRange, CheckCircle2, Clock } from 'lucide-react';
import type { ReactElement } from 'react';

import { EnvBadge } from '@/components/env-badge';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { usePageTitle } from '@/hooks/use-page-title';
import { formatCount, formatDateTime } from '@/lib/format';

import { AsyncSection } from '@/components/async-section';
import { RetentionTable } from '../components/retention-table';
import { useComplianceReport } from '../hooks/use-security';
import type { ComplianceFramework, FrameworkStatus } from '../types/security.types';

/** Framework readiness → tone + label for the status badge. */
const FRAMEWORK_TONE: Record<FrameworkStatus, QTagColor> = {
  supported: 'success',
  extension_point: 'info',
};

const FRAMEWORK_LABEL: Record<FrameworkStatus, string> = {
  supported: 'Supported',
  extension_point: 'Extension point',
};

const FRAMEWORK_COLUMNS: TableColumnsType<ComplianceFramework> = [
  {
    title: 'Framework',
    dataIndex: 'framework',
    key: 'framework',
    render: (framework: string) => <span className="font-medium text-ink">{framework}</span>,
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status: FrameworkStatus) => (
      <StatusBadge status={status} tone={FRAMEWORK_TONE[status]} label={FRAMEWORK_LABEL[status]} />
    ),
  },
  { title: 'Notes', dataIndex: 'notes', key: 'notes' },
];

/**
 * Compliance Dashboard (P7.2). Read-only, admin-gated. A single `/admin/compliance/report` read
 * powers: audit-activity tiles (today / this week / this month), the framework-readiness table
 * (GDPR supported; CCPA / residency / legal-hold / SOC 2 / PCI as extension points), the
 * data-retention registry, and the data-subject-rights the platform honors.
 */
export function ComplianceDashboardPage(): ReactElement {
  usePageTitle('Compliance dashboard');
  const query = useComplianceReport();
  const report = query.data;

  return (
    <PageContainer>
      <PageHeader
        title="Compliance dashboard"
        description="Compliance posture, framework readiness, retention registry, and data-subject rights."
        actions={<EnvBadge />}
      />

      <AsyncSection
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        loadingRows={6}
      >
        {report ? (
          <div className="flex flex-col gap-6">
            {/* Audit activity — stat tiles. */}
            <section className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold text-ink">Audit activity</h2>
                <p className="text-sm text-ink-secondary">
                  Generated {formatDateTime(report.generatedAt)}.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                  label="Today"
                  value={formatCount(report.audit.today)}
                  icon={Clock}
                  hint="Audit events today"
                />
                <StatCard
                  label="This week"
                  value={formatCount(report.audit.thisWeek)}
                  icon={CalendarDays}
                  hint="Audit events this week"
                />
                <StatCard
                  label="This month"
                  value={formatCount(report.audit.thisMonth)}
                  icon={CalendarRange}
                  hint="Audit events this month"
                />
              </div>
            </section>

            {/* Framework readiness. */}
            <QCard as="section" padding="lg" className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-ink">Framework readiness</h2>
              <Table<ComplianceFramework>
                columns={FRAMEWORK_COLUMNS}
                dataSource={report.frameworks}
                rowKey="framework"
                pagination={false}
                size="middle"
                sticky
                scroll={{ x: 'max-content' }}
              />
            </QCard>

            {/* Data-retention registry. */}
            <RetentionTable rules={report.retention} />

            {/* Data-subject rights. */}
            <QCard as="section" padding="lg" className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-ink">Data-subject rights</h2>
              <ul className="flex flex-col gap-3">
                {report.dataSubjectRights.map((right) => (
                  <li key={right} className="flex items-center gap-2 text-sm text-ink">
                    <CheckCircle2
                      size={18}
                      strokeWidth={1.75}
                      className="flex-shrink-0 text-success"
                      aria-hidden
                    />
                    {right}
                  </li>
                ))}
              </ul>
            </QCard>
          </div>
        ) : null}
      </AsyncSection>
    </PageContainer>
  );
}
