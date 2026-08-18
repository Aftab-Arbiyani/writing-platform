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
            A2's warning here is DELETED rather than reworded, because the limit it described is
            gone (B9, A2-4). It said a mistyped id read as a brand-new account in good standing —
            which was true: the standing read called `getOrCreateProfile`, so it manufactured a
            default profile for any well-formed UUID, and `trust_profiles` has no foreign key to
            `users` to stop it. The read now writes nothing and 404s an id that belongs to nobody,
            so an unknown account is a "not found", not a clean record. Nothing needs confirming
            before acting on what this screen shows.

            Note this diverges from B8-1, which left the monetization per-account reads returning a
            nullable shape for the same question — see docs/48 §6.17.
          */}
          <p className="text-xs text-ink-muted">
            An ID that belongs to no account is reported as not found, so what you see here is
            always a real account&rsquo;s record.
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
