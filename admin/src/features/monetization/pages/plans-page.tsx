import type { ReactElement } from 'react';

import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';

import { AsyncSection } from '@/components/async-section';
import { ConfigForm } from '../components/config-form';
import { PlanCatalogue } from '../components/plan-catalogue';
import { useMonetizationConfig, usePlans } from '../hooks/use-monetization';

/**
 * Plans & pricing (A1a) — the resolved plan catalogue plus the cross-cutting config.
 *
 * The two live on one page because they are one decision surface: a tier's limits and the platform's
 * credit/trial/grace maths are read together whenever an operator is answering "what is this account
 * entitled to and what will it cost". Splitting them would mean two routes that are always visited
 * in sequence.
 *
 * Each section wraps its own query, so a failing config read does not blank the catalogue.
 */
export function PlansPage(): ReactElement {
  usePageTitle('Plans & pricing');
  const plans = usePlans();
  const config = useMonetizationConfig();

  return (
    <PageContainer>
      <PageHeader
        title="Plans & pricing"
        description="The resolved plan catalogue and the platform-wide billing config."
      />

      <div className="flex flex-col gap-6">
        <AsyncSection
          isLoading={plans.isLoading}
          error={plans.error}
          onRetry={() => void plans.refetch()}
          loadingRows={6}
        >
          {plans.data ? <PlanCatalogue plans={plans.data} settingsHref={ROUTES.settings} /> : null}
        </AsyncSection>

        <AsyncSection
          isLoading={config.isLoading}
          error={config.error}
          onRetry={() => void config.refetch()}
        >
          {config.data ? <ConfigForm config={config.data} /> : null}
        </AsyncSection>
      </div>
    </PageContainer>
  );
}
