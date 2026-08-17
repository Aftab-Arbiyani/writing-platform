import type { ReactElement } from 'react';

import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { usePageTitle } from '@/hooks/use-page-title';

import { CreditAdjustForm } from '../components/credit-adjust-form';
import { RefundForm } from '../components/refund-form';

/**
 * The money actions (A1b) — credit adjustment and refunds on one page.
 *
 * They share a page because they share a situation: an operator resolving a billing complaint reaches
 * for one or the other, usually after the same support ticket. Neither has a list to browse (no admin
 * route exposes another user's wallet or their payments), so both are id-in, action-out forms and
 * neither would fill a route of its own.
 *
 * Both are destructive in one direction and both confirm there; see each component for which and why.
 */
export function BillingActionsPage(): ReactElement {
  usePageTitle('Billing actions');

  return (
    <PageContainer>
      <PageHeader
        title="Billing actions"
        description="Adjust a credit balance or refund a payment. Both are recorded in the audit trail."
      />

      <div className="flex flex-col gap-6">
        <CreditAdjustForm />
        <RefundForm />
      </div>
    </PageContainer>
  );
}
