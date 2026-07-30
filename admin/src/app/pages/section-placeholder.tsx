import { QCard } from '@qalam/ui';
import type { ReactElement } from 'react';

import { AppBreadcrumbs } from '@/components/app-breadcrumbs';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { usePageTitle } from '@/hooks/use-page-title';

/**
 * Generic section placeholder (A1 ships no business features). Each lazy section route renders this
 * with its own title, proving the shell + routing + guards + breadcrumbs + page primitives are wired
 * — the real page lands in that section's feature epic, built on the shared `DataTable`/hooks.
 */
export interface SectionPlaceholderProps {
  title: string;
  description?: string;
}

export function SectionPlaceholder({ title, description }: SectionPlaceholderProps): ReactElement {
  usePageTitle(title);
  return (
    <PageContainer>
      <PageHeader title={title} description={description} breadcrumbs={<AppBreadcrumbs />} />
      <QCard padding="lg">
        <p className="text-sm text-ink-secondary">
          The <span className="font-medium text-ink">{title}</span> section arrives in a later admin
          epic. The foundation — shell, routing, role guards, data table, filters, and pagination
          hooks — is ready to build it on.
        </p>
      </QCard>
    </PageContainer>
  );
}
