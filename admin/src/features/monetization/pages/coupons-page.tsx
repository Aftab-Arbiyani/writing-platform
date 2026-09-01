import { QCard, QSectionHeader } from '@qalam/ui';
import type { ReactElement } from 'react';

import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { usePageTitle } from '@/hooks/use-page-title';

import { AsyncSection } from '@/components/async-section';
import { CouponCreateForm } from '../components/coupon-create-form';
import { CouponTable } from '../components/coupon-table';
import { useCoupons } from '../hooks/use-monetization';

/** Coupons (A1b) — list, create, and activate/deactivate. */
export function CouponsPage(): ReactElement {
  usePageTitle('Coupons');
  const coupons = useCoupons();

  return (
    <PageContainer>
      <PageHeader
        title="Coupons"
        description="Promotional codes redeemable at checkout, with their redemption counts."
      />

      <div className="flex flex-col gap-6">
        <CouponCreateForm />

        <QCard padding="md" className="flex flex-col gap-3">
          <QSectionHeader title="All coupons" />
          <AsyncSection
            isLoading={coupons.isLoading}
            error={coupons.error}
            onRetry={() => void coupons.refetch()}
          >
            <CouponTable coupons={coupons.data ?? []} />
          </AsyncSection>
        </QCard>
      </div>
    </PageContainer>
  );
}
