import { ERROR_CODES, InvitationStatus, POLICY_ACTIONS } from '@qalam/shared';
import { QButton, QCard, QTag } from '@qalam/ui';
import type { ReactElement } from 'react';

import { isApiError } from '@/lib/errors';

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

/**
 * B6's accept-side refusal (docs/45 §4.11), in the invitee's own terms.
 *
 * The invitation was valid when it was sent; the owner has since downgraded or filled the story.
 * **No upsell and no "See plans" here** — the reader of this line cannot buy a seat on someone
 * else's plan, and pointing them at pricing would bill the wrong person for the wrong problem.
 * The invitation stays pending server-side, so "ask them, then accept" is real advice and not a
 * consolation: the accept works the moment a seat frees.
 */
function acceptErrorMessage(error: unknown): string | null {
  if (!isApiError(error)) return null;
  if (error.code === ERROR_CODES.COLLABORATOR_SEATS_UNAVAILABLE) {
    return (
      'This story is full — the owner’s plan has no collaborator seats left. Your invitation is ' +
      'still valid, so you can accept once they free one.'
    );
  }
  if (error.code === ERROR_CODES.INVITATION_EXPIRED) {
    return 'This invitation has expired. Ask for a new one.';
  }
  return 'The invitation couldn’t be accepted.';
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
        // Scoped to the row the viewer actually acted on: a shared mutation would otherwise paint
        // the refusal onto every pending invitation in the inbox.
        const acceptError =
          accept.isError && accept.variables?.invitationId === invitation.id
            ? acceptErrorMessage(accept.error)
            : null;
        // Outgoing rows are about the invitee; incoming rows are about who invited you.
        const subjectId = mode === 'outgoing' ? invitation.inviteeId : invitation.inviterId;

        return (
          <li key={invitation.id}>
            <QCard>
              <div className="flex flex-col gap-3">
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

                {acceptError === null ? null : (
                  /*
                   * `role="alert"`: unlike the owner-side seat notice, this appears in response to
                   * something the viewer just did, so announcing it immediately is the point.
                   */
                  <p role="alert" className="text-warning text-sm">
                    {acceptError}
                  </p>
                )}
              </div>
            </QCard>
          </li>
        );
      })}
    </ul>
  );
}
