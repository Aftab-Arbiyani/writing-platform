import { QCard, QSectionHeader } from '@qalam/ui';
import { useState, type ReactElement } from 'react';

import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { SearchInput } from '@/components/search-input';
import { usePageTitle } from '@/hooks/use-page-title';

import { TrustPanel } from '../components/trust-panel';

/**
 * Trust & Safety for one account (AF6, row A2) — the standalone entry point.
 *
 * **Why this route exists as well as the drawer tab.** The same panel is a tab on the user detail
 * drawer, which is the better place to read it: the account-suspension controls are on that screen,
 * and the two sanctions have to be told apart. But `/users` is gated `RequireRole min={Role.Admin}`
 * (`router.tsx`), and `Role.Moderator` is precisely the role whose grants name `trust.view` and
 * `trust.manage` (`DEFAULT_ROLE_PERMISSIONS`) — so without a route below the admin floor the trust
 * surface would be unreachable for the operator it was built for.
 *
 * **It takes a user ID, not a handle**, on the B8 precedent (`entitlements-page.tsx`): the two
 * trust reads are per-account, there is no cross-account trust route to list from, and resolving a
 * handle would mean a moderator-visible copy of the users list — which they may not see, and which
 * `features/README.md` would not let another feature import anyway.
 */
export function UserTrustPage(): ReactElement {
  usePageTitle('Trust & safety');
  const [userId, setUserId] = useState('');

  return (
    <PageContainer>
      <PageHeader
        title="Trust & safety"
        description="Reputation, strikes and restrictions for one account."
      />

      <div className="flex flex-col gap-6">
        <QCard padding="md" className="flex flex-col gap-3">
          <QSectionHeader
            title="Find an account"
            description="Paste the user's ID. There is no cross-account trust list on the server."
          />
          <div className="max-w-md">
            <SearchInput
              value={userId}
              onChange={setUserId}
              placeholder="User ID (UUID)"
              ariaLabel="User ID"
            />
          </div>
          {/*
            The honest limit of a per-account read, in the same terms B8 recorded it (docs/48 §3,
            B8-1) — and trust states it more loudly, because the standing read does not merely
            return an empty shape for an unknown id: it MANUFACTURES a default one
            (`getOrCreateProfile`, `trust.service.ts:104`) and `trust_profiles` has no foreign key
            to `users`. A mistyped id therefore reads as a brand-new account in good standing.
          */}
          <p className="text-xs text-ink-muted">
            A user ID that does not exist reads as a clean account: the standing read creates a
            default profile for any ID it is given, so confirm the ID before acting on what you see.
          </p>
        </QCard>

        {userId === '' ? (
          <EmptyState
            title="No account selected"
            description="Enter a user ID above to see their trust standing and restrictions."
            minHeight={200}
          />
        ) : (
          <TrustPanel userId={userId} />
        )}
      </div>
    </PageContainer>
  );
}
