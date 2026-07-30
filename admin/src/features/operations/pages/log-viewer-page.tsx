import { QCard, QTag } from '@qalam/ui';
import { FileJson, ScrollText } from 'lucide-react';
import type { ReactElement } from 'react';

import { EnvBadge } from '@/components/env-badge';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { usePageTitle } from '@/hooks/use-page-title';
import { formatCount, formatPercent } from '@/lib/format';

import { AsyncSection } from '../components/async-section';
import { BoolIndicator } from '../components/bool-indicator';
import { DefinitionCard } from '../components/definition-card';
import { useObservability } from '../hooks/use-operations';

/**
 * Log Viewer (P7.4). The platform ships structured logs to the collector — there is NO log-stream
 * endpoint, so this page documents the logging POSTURE (structure, format, sampling, retention,
 * redaction) and the log classes the platform emits, drawn from the observability report. Read-only,
 * admin-gated.
 */
export function LogViewerPage(): ReactElement {
  usePageTitle('Logs');
  const query = useObservability();
  const logging = query.data?.logging;

  return (
    <PageContainer>
      <PageHeader
        title="Logs"
        description="The platform's structured-logging posture and the log classes it emits."
        actions={<EnvBadge />}
      />

      <AsyncSection
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        loadingRows={5}
      >
        {logging ? (
          <div className="flex flex-col gap-6">
            <QCard as="section" padding="lg">
              <p className="text-sm text-ink-secondary">
                Logs are emitted as structured events to the platform's collector. There is no live
                log stream in the console — inspect and search logs in the log backend; this page
                describes the policy the platform enforces.
              </p>
            </QCard>

            <DefinitionCard
              title="Logging posture"
              icon={FileJson}
              items={[
                {
                  label: 'Structured',
                  value: (
                    <BoolIndicator
                      value={logging.structured}
                      trueLabel="Structured"
                      falseLabel="Unstructured"
                      falseStatus="warning"
                    />
                  ),
                },
                {
                  label: 'Format',
                  value: <span className="font-mono text-sm text-ink">{logging.format}</span>,
                },
                { label: 'Sample rate', value: formatPercent(logging.sampleRate) },
                { label: 'Retention', value: `${formatCount(logging.retentionDays)} days` },
                {
                  label: 'Redaction enforced',
                  value: (
                    <BoolIndicator
                      value={logging.redactionEnforced}
                      trueLabel="Enforced"
                      falseLabel="Not enforced"
                      falseStatus="warning"
                    />
                  ),
                },
                { label: 'Log classes', value: formatCount(logging.classes.length) },
              ]}
            />

            <QCard as="section" padding="lg" className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <ScrollText
                  size={18}
                  strokeWidth={1.75}
                  className="text-ink-secondary"
                  aria-hidden
                />
                <h2 className="text-base font-semibold text-ink">Log classes</h2>
              </div>
              {logging.classes.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {logging.classes.map((logClass) => (
                    <li key={logClass}>
                      <QTag color="neutral" size="md">
                        {logClass}
                      </QTag>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">No log classes reported.</p>
              )}
            </QCard>
          </div>
        ) : null}
      </AsyncSection>
    </PageContainer>
  );
}
