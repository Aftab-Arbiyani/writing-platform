import { InvitationStatus, POLICY_ACTIONS } from '@qalam/shared';
import { QButton, QCard, QTag } from '@qalam/ui';
import type { ReactElement } from 'react';

import { useInvitationActions } from '../hooks/use-invitations';
import type { StoryInvitation } from '../types/collaboration.types';
import { CapabilityGate } from './capability-gate';
import { CollaboratorIdentity } from './collaborator-identity';
import { RoleBadge } from './role-badge';

/**
 * Story invitations, in two modes (AF6, W3a):
 *
 * - `mode="outgoing"` — what a story's managers sent, with revoke. Rendered on the collaborators
 *   page, so it is capability-gated on `story.invite`.
 * - `mode="incoming"` — the viewer's own inbox (mobile's `invitations_inbox_screen`), with
 *   accept / decline. Authorization here is invitation ownership (the invitee holds the token),
 *   **not** a story capability — the invitee is by definition not yet a member, so gating these
 *   buttons on a story capability would hide the only action they can take.
 */
const STATUS_LABEL: Record<string, string> = {
  [InvitationStatus.Pending]: 'Pending',
  [InvitationStatus.Accepted]: 'Accepted',
  [InvitationStatus.Declined]: 'Declined',
  [InvitationStatus.Revoked]: 'Revoked',
  [InvitationStatus.Expired]: 'Expired',
};

function expiryHint(invitation: StoryInvitation): string | null {
  if (invitation.status !== InvitationStatus.Pending) return null;
  const msLeft = new Date(invitation.expiresAt).getTime() - Date.now();
  if (Number.isNaN(msLeft)) return null;
  if (msLeft <= 0) return 'Expired';
  const days = Math.floor(msLeft / 86_400_000);
  const hours = Math.floor(msLeft / 3_600_000);
  return days >= 1 ? `Expires in ${days} day${days === 1 ? '' : 's'}` : `Expires in ${hours}h`;
}

export interface InvitationListProps {
  invitations: StoryInvitation[];
  mode: 'incoming' | 'outgoing';
  /** Required for `outgoing` — the story whose `story.invite` capability gates revoke. */
  storyId?: string;
}

export function InvitationList({
  invitations,
  mode,
  storyId,
}: InvitationListProps): ReactElement | null {
  const { accept, decline, revoke } = useInvitationActions(storyId);
  if (invitations.length === 0) return null;

  return (
    <ul className="flex flex-col gap-3">
      {invitations.map((invitation) => {
        const pending = invitation.status === InvitationStatus.Pending;
        const hint = expiryHint(invitation);
        // Outgoing rows are about the invitee; incoming rows are about who invited you.
        const subjectId = mode === 'outgoing' ? invitation.inviteeId : invitation.inviterId;

        return (
          <li key={invitation.id}>
            <QCard>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CollaboratorIdentity userId={subjectId} />
                  <span className="text-ink-muted text-xs">
                    {mode === 'incoming' ? 'invited you as' : 'invited as'}{' '}
                    <RoleBadge role={invitation.role} />
                    {hint ? <span className="ms-2">· {hint}</span> : null}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {pending ? null : (
                    <QTag size="sm">{STATUS_LABEL[invitation.status] ?? invitation.status}</QTag>
                  )}

                  {pending && mode === 'incoming' ? (
                    <>
                      <QButton
                        size="sm"
                        loading={accept.isPending}
                        // The story id travels as a variable — the accept response is a member and
                        // carries none (docs/49 §5).
                        onClick={() =>
                          accept.mutate({
                            invitationId: invitation.id,
                            storyId: invitation.storyId,
                          })
                        }
                      >
                        Accept
                      </QButton>
                      <QButton
                        variant="secondary"
                        size="sm"
                        loading={decline.isPending}
                        onClick={() => decline.mutate(invitation.id)}
                      >
                        Decline
                      </QButton>
                    </>
                  ) : null}

                  {pending && mode === 'outgoing' && storyId ? (
                    <CapabilityGate storyId={storyId} action={POLICY_ACTIONS.StoryInvite}>
                      <QButton
                        variant="secondary"
                        size="sm"
                        loading={revoke.isPending}
                        onClick={() => revoke.mutate(invitation.id)}
                      >
                        Revoke
                      </QButton>
                    </CapabilityGate>
                  ) : null}
                </div>
              </div>
            </QCard>
          </li>
        );
      })}
    </ul>
  );
}
