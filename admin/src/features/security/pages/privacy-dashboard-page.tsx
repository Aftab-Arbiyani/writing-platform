import { QCard } from '@qalam/ui';
import { FileDown, Trash2, UserCheck } from 'lucide-react';
import type { ReactElement } from 'react';

import { EnvBadge } from '@/components/env-badge';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { usePageTitle } from '@/hooks/use-page-title';

import { AsyncSection } from '@/components/async-section';
import { AuditLinkCard } from '../components/audit-link-card';
import { DefinitionCard } from '../components/definition-card';
import { RetentionTable } from '../components/retention-table';
import { useRetention } from '../hooks/use-security';
import type { ConsentPurposeInfo, DsrKindInfo } from '../types/security.types';

/**
 * Consent-purpose catalog — mirrors the backend `CONSENT_PURPOSE` vocabulary. There is no admin
 * per-user consent endpoint (consent is user-scoped, durable in Redis, and every change is written
 * to the immutable audit log), so this overview documents WHAT the platform tracks; the audit log
 * (below) is where per-user consent changes are inspected.
 */
const CONSENT_PURPOSES: ConsentPurposeInfo[] = [
  {
    key: 'analytics',
    label: 'Analytics',
    description: 'Product analytics and engagement metrics.',
  },
  {
    key: 'marketing',
    label: 'Marketing',
    description: 'Marketing and lifecycle email beyond transactional.',
  },
  {
    key: 'ai_personalization',
    label: 'AI personalization',
    description: "Use of the user's content to improve AI features.",
  },
  {
    key: 'cookies',
    label: 'Cookies',
    description: 'Non-essential cookies and client storage.',
  },
];

/** Data-subject-request kinds the platform fulfils (mirrors backend `DSR_KIND`). */
const DSR_KINDS: DsrKindInfo[] = [
  {
    key: 'export',
    label: 'Data export',
    article: 'GDPR Art. 15',
    description: 'A user can request a machine-readable export of their personal data.',
  },
  {
    key: 'erasure',
    label: 'Erasure',
    article: 'GDPR Art. 17',
    description: 'A user can request deletion of their personal data ("right to be forgotten").',
  },
];

const DSR_ICON = { export: FileDown, erasure: Trash2 } as const;

/**
 * Privacy Dashboard (P7.2). Read-only, admin-gated. Documents the consent purposes the platform
 * tracks and the data-subject requests (DSR) it fulfils, and reuses the compliance retention
 * registry (`/admin/compliance/retention`). There is no admin per-user consent endpoint by design —
 * per-user consent + DSR events are inspected via the audit log, filtered to the `privacy` category.
 */
export function PrivacyDashboardPage(): ReactElement {
  usePageTitle('Privacy dashboard');
  const retentionQuery = useRetention();
  const retention = retentionQuery.data;

  return (
    <PageContainer>
      <PageHeader
        title="Privacy dashboard"
        description="Consent purposes, data-subject rights, and data-retention for this platform."
        actions={<EnvBadge />}
      />

      {/* Consent purposes overview (static catalog — no admin per-user consent endpoint). */}
      <DefinitionCard
        title="Consent purposes"
        description="The purposes users can grant or withdraw. Per-user consent changes are audited (see below)."
        icon={UserCheck}
        items={CONSENT_PURPOSES.map((purpose) => ({
          label: purpose.label,
          value: purpose.description,
        }))}
      />

      {/* Data-subject-request explainer. */}
      <QCard as="section" padding="lg" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-ink">Data-subject requests</h2>
          <p className="text-sm text-ink-secondary">
            The requests a data subject can make. Each request is processed through the platform's
            DSR pipeline and recorded in the audit log.
          </p>
        </div>
        <ul className="flex flex-col gap-4">
          {DSR_KINDS.map((dsr) => {
            const Icon = DSR_ICON[dsr.key as keyof typeof DSR_ICON];
            return (
              <li key={dsr.key} className="flex gap-3">
                <span className="flex size-10 flex-shrink-0 items-center justify-center rounded-md bg-raised">
                  <Icon size={20} strokeWidth={1.75} className="text-accent" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-ink">
                    {dsr.label}{' '}
                    <span className="font-normal text-ink-secondary">· {dsr.article}</span>
                  </span>
                  <span className="text-sm text-ink-secondary">{dsr.description}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </QCard>

      {/* Data-retention registry (reused from the compliance retention endpoint). */}
      <AsyncSection
        isLoading={retentionQuery.isLoading}
        error={retentionQuery.error}
        onRetry={() => void retentionQuery.refetch()}
        loadingRows={5}
      >
        {retention ? <RetentionTable rules={retention.retention} /> : null}
      </AsyncSection>

      {/* Privacy event feed → the existing Audit Logs browser, filtered to `privacy`. */}
      <AuditLinkCard
        category="privacy"
        title="Privacy event viewer"
        description="Browse privacy-category events — consent changes and DSR activity — in the audit log."
      />
    </PageContainer>
  );
}
