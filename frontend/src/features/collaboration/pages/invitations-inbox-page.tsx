import { QEmptyState, QErrorState, QSkeleton } from '@qalam/ui';
import { Mail } from 'lucide-react';
import type { ReactElement } from 'react';

import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage, getRequestId } from '@/lib/errors';

import { InvitationList } from '../components/invitation-list';
import { useMyInvitations } from '../hooks/use-invitations';
import { isCollaborationEnabled } from '../lib/collaboration-enabled';

/**
 * The viewer's collaboration inbox (`/me/invitations`, AF6 W3a) — mobile's
 * `invitations_inbox_screen`.
 *
 * **Pending only, because that is all the endpoint returns** (`listMine` filters to
 * `InvitationStatus.Pending`). An earlier draft of this page also rendered an "Earlier" section for
 * accepted/declined invitations; that section could never populate, and answering an invitation
 * simply removes it from this list. If a history view is ever wanted it needs a backend change, not
 * a client one.
 */
export function InvitationsInboxPage(): ReactElement {
  usePageTitle('Invitations');
  const enabled = isCollaborationEnabled();
  const query = useMyInvitations(enabled);

  if (!enabled) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 py-6 sm:px-6">
        <QEmptyState
          icon={Mail}
          title="Collaboration is off"
          description="Enable collaboration to co-write and review with others."
        />
      </div>
    );
  }

  const invitations = query.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-ink font-serif text-2xl font-semibold">Invitations</h1>

      {query.isLoading ? (
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading invitations"
          className="flex flex-col gap-3"
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 py-2">
              <QSkeleton variant="avatar" avatarSize={32} />
              <div className="flex-1">
                <QSkeleton variant="title" width="45%" />
              </div>
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <QErrorState
          title="Couldn’t load your invitations."
          description={getErrorMessage(query.error)}
          requestId={getRequestId(query.error)}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : invitations.length === 0 ? (
        <QEmptyState
          icon={Mail}
          title="No invitations"
          description="When someone invites you to work on a story, it will appear here."
        />
      ) : (
        <InvitationList invitations={invitations} mode="incoming" />
      )}
    </div>
  );
}
