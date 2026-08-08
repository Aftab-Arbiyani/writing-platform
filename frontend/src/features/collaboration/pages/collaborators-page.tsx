import { POLICY_ACTIONS } from '@qalam/shared';
import { QButton, QEmptyState, QErrorState, QSectionHeader, QSkeleton } from '@qalam/ui';
import { UserPlus, Users } from 'lucide-react';
import { type ReactElement, useState } from 'react';
import { useParams } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage, getRequestId } from '@/lib/errors';

import { CapabilityGate } from '../components/capability-gate';
import {
  COLLABORATOR_SEAT_NOTICE_ID,
  CollaboratorSeatCount,
  CollaboratorSeatNotice,
} from '../components/collaborator-seat-notice';
import { InvitationList } from '../components/invitation-list';
import { InviteDialog } from '../components/invite-dialog';
import { MemberList } from '../components/member-list';
import { PresenceBar } from '../components/presence-bar';
import { useCollaboratorLimit } from '../hooks/use-collaborator-limit';
import { useStoryInvitations } from '../hooks/use-invitations';
import { useStoryMembers } from '../hooks/use-members';
import { usePresenceHeartbeat, useStoryPresence } from '../hooks/use-presence';
import { isCollaborationEnabled } from '../lib/collaboration-enabled';
import { resolveCollaboratorAllowanceNotice } from '../lib/collaborator-allowance';

/**
 * The collaborators page (`/write/:storyId/collaborators`, AF6 W3a) — the membership home for one
 * story. Ported from mobile's `collaborators_screen`: roster with roles, capability-gated
 * management, a presence bar, and the story's outstanding invitations.
 *
 * Like mobile, the heading is just "Collaborators" — it does **not** fetch the piece to show a
 * title. That keeps the page to collaboration data alone (and keeps this feature from reaching into
 * the reading or writing feature, which docs/26 §4 forbids).
 */
export function CollaboratorsPage(): ReactElement {
  usePageTitle('Collaborators');
  const { storyId = '' } = useParams<{ storyId: string }>();
  const [inviteOpen, setInviteOpen] = useState(false);

  const enabled = isCollaborationEnabled();
  const members = useStoryMembers(enabled ? storyId : undefined);
  const invitations = useStoryInvitations(enabled ? storyId : undefined);
  const presence = useStoryPresence(enabled ? storyId : undefined);
  usePresenceHeartbeat(storyId, enabled);
  // B6 seats. The route is `story.invite`-authorized, so a viewer who cannot invite would only get
  // a 403 — the query stays off for them and the notice never renders, which is correct: the seat
  // count is the owner's business and the upsell is addressed to whoever pays.
  const seats = useCollaboratorLimit(enabled ? storyId : undefined);
  const seatNotice = resolveCollaboratorAllowanceNotice(seats.data);

  // The client kill switch, mirroring mobile's five self-gating screens (docs/49 §2.2). The server
  // has its own master flag; this one only keeps the surface out of reach while it is dark.
  if (!enabled) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 py-6 sm:px-6">
        <QEmptyState
          icon={Users}
          title="Collaboration is off"
          description="Enable collaboration to co-write and review with others."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 py-6 sm:px-6">
      <QSectionHeader
        title={<h1 className="text-ink font-serif text-2xl font-semibold">Collaborators</h1>}
        description="Who can read, comment on, and edit this story."
        actions={
          <CapabilityGate storyId={storyId} action={POLICY_ACTIONS.StoryInvite}>
            <div className="flex items-center gap-3">
              {/* "2 of 3 collaborators" — the count BEFORE the wall (docs/45 §4.11). */}
              <CollaboratorSeatCount notice={seatNotice} />
              <QButton
                size="sm"
                icon={UserPlus}
                /*
                 * Disabled, never hidden. A free author must be able to SEE that collaboration
                 * exists and what it costs — hiding the affordance is mobile's C-1 defect, and
                 * leaving it live to 402 is W3c-1. `aria-describedby` ties the button to the
                 * notice, so a screen reader is told WHY it is off rather than just that it is.
                 */
                disabled={seatNotice.blocked}
                aria-describedby={seatNotice.blocked ? COLLABORATOR_SEAT_NOTICE_ID : undefined}
                onClick={() => setInviteOpen(true)}
              >
                Invite
              </QButton>
            </div>
          </CapabilityGate>
        }
      />

      <CapabilityGate storyId={storyId} action={POLICY_ACTIONS.StoryInvite}>
        <CollaboratorSeatNotice notice={seatNotice} />
      </CapabilityGate>

      {presence.data && presence.data.length > 0 ? <PresenceBar presence={presence.data} /> : null}

      {members.isLoading ? (
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading collaborators"
          className="flex flex-col gap-3"
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 py-2">
              <QSkeleton variant="avatar" avatarSize={32} />
              <div className="flex-1">
                <QSkeleton variant="title" width="35%" />
              </div>
            </div>
          ))}
        </div>
      ) : members.isError ? (
        <QErrorState
          title="Couldn’t load the collaborators."
          description={getErrorMessage(members.error)}
          requestId={getRequestId(members.error)}
          onRetry={() => {
            void members.refetch();
          }}
        />
      ) : (members.data?.length ?? 0) === 0 ? (
        // Practically unreachable — the owner is always synthesised into the roster — but a story
        // whose author row cannot be resolved should say so rather than render an empty list.
        <QEmptyState
          icon={Users}
          title="No collaborators yet"
          description="Invite a co-author, editor, or reader to work on this story with you."
        />
      ) : (
        <MemberList storyId={storyId} members={members.data ?? []} />
      )}

      {(invitations.data?.length ?? 0) > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-ink-muted text-xs font-medium uppercase">Pending invitations</h2>
          <InvitationList invitations={invitations.data ?? []} mode="outgoing" storyId={storyId} />
        </section>
      ) : null}

      <InviteDialog storyId={storyId} open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
