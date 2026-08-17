import { QCard, QSectionHeader } from '@qalam/ui';
import { useState, type ReactElement } from 'react';

import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { SearchInput } from '@/components/search-input';
import { usePageTitle } from '@/hooks/use-page-title';

import { AsyncSection } from '../components/async-section';
import { EntitlementCacheNote } from '../components/entitlement-cache-note';
import { OverrideGrantForm } from '../components/override-grant-form';
import { OverrideTable } from '../components/override-table';
import { useOverrides } from '../hooks/use-monetization';

/**
 * Entitlement overrides (A1a) — look up one account's overrides, grant one, revoke one.
 *
 * **It takes a user ID, not a name or handle, and that is a contract limit rather than a choice.**
 * `GET overrides/:userId` is the only read, there is no route that lists overrides across accounts,
 * and resolving a handle to an id would mean importing `features/users` — which the deletability rule
 * forbids (`features/README.md`). So the operator pastes an id, which is what they already have when
 * they arrive here from a support ticket or the Users screen.
 */
export function EntitlementsPage(): ReactElement {
  usePageTitle('Entitlement overrides');
  const [userId, setUserId] = useState('');
  const overrides = useOverrides(userId);

  return (
    <PageContainer>
      <PageHeader
        title="Entitlement overrides"
        description="Administrative, promotional and temporary grants that outrank a user's plan."
      />

      <div className="flex flex-col gap-6">
        <EntitlementCacheNote />

        <QCard padding="md" className="flex flex-col gap-3">
          <QSectionHeader
            title="Find an account"
            description="Paste the user's ID. There is no cross-account override list on the server."
          />
          <div className="max-w-md">
            <SearchInput
              value={userId}
              onChange={setUserId}
              placeholder="User ID (UUID)"
              ariaLabel="User ID"
            />
          </div>
        </QCard>

        {userId === '' ? (
          <EmptyState
            title="No account selected"
            description="Enter a user ID above to see their entitlement overrides."
            minHeight={200}
          />
        ) : (
          <>
            <QCard padding="md" className="flex flex-col gap-3">
              <QSectionHeader title="Active overrides" />
              <AsyncSection
                isLoading={overrides.isLoading}
                error={overrides.error}
                onRetry={() => void overrides.refetch()}
              >
                <OverrideTable overrides={overrides.data ?? []} />
              </AsyncSection>
            </QCard>

            <OverrideGrantForm userId={userId} />
          </>
        )}
      </div>
    </PageContainer>
  );
}
