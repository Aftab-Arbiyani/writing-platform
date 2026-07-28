import {
  ASSIGNABLE_STORY_ROLES,
  ERROR_CODES,
  MAX_STORY_COLLABORATORS,
  StoryRole,
  type StoryRole as Role,
} from '@qalam/shared';
import { QButton, QDialog, QInput, QSelect } from '@qalam/ui';
import { type ReactElement, useState } from 'react';

import { useDebounce } from '@/hooks/use-debounce';
import { isApiError } from '@/lib/errors';

import { useInvitationActions, useResolveHandle } from '../hooks/use-invitations';

/**
 * Invite a collaborator (AF6, W3a).
 *
 * **This is the one surface not ported from mobile, and deliberately so.** Mobile asks for an
 * email and sends `{role, email}`; the contract requires `{inviteeId, role}` under
 * `forbidNonWhitelisted`, so every mobile invite 400s — defect **M-1**, docs/48 §3.1. There is no
 * invite-by-email path in the backend at all, so an email field cannot be made to work.
 *
 * What the contract does support is inviting a known user by id, so the flow is:
 * `@handle → GET /users/:username → id → POST {inviteeId, role}`. The handle is resolved as the
 * writer types (debounced) and the submit button stays disabled until a real person is on screen —
 * so the viewer confirms *who* they are inviting before it is sent, which an email field never does.
 */
const ROLE_LABEL: Record<Role, string> = {
  [StoryRole.Owner]: 'Owner',
  [StoryRole.CoAuthor]: 'Co-author',
  [StoryRole.Editor]: 'Editor',
  [StoryRole.Reviewer]: 'Reviewer',
  [StoryRole.BetaReader]: 'Beta reader',
};

const ROLE_OPTIONS = ASSIGNABLE_STORY_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABEL[role],
}));

export interface InviteDialogProps {
  storyId: string;
  open: boolean;
  onClose: () => void;
}

export function InviteDialog({ storyId, open, onClose }: InviteDialogProps): ReactElement {
  const [handle, setHandle] = useState('');
  const [role, setRole] = useState<Role>(StoryRole.Editor);
  const debouncedHandle = useDebounce(handle, 350);

  const resolved = useResolveHandle(debouncedHandle);
  const { invite } = useInvitationActions(storyId);

  const invitee = resolved.data;
  const notFound = resolved.isError && isApiError(resolved.error) && resolved.error.status === 404;

  const reset = (): void => {
    setHandle('');
    setRole(StoryRole.Editor);
    invite.reset();
    onClose();
  };

  const submit = (): void => {
    if (!invitee) return;
    invite.mutate({ inviteeId: invitee.id, role }, { onSuccess: reset });
  };

  return (
    <QDialog
      open={open}
      onClose={reset}
      title="Invite a collaborator"
      description="Invite someone by their Qalam handle, then choose what they can do."
      footer={
        <div className="flex justify-end gap-2">
          <QButton variant="secondary" onClick={reset}>
            Cancel
          </QButton>
          <QButton
            // Disabled until a real person is resolved — the guard that makes an id-based
            // invite usable, and the thing mobile's email box lacks.
            disabled={!invitee}
            loading={invite.isPending}
            onClick={submit}
          >
            Send invitation
          </QButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <QInput
          label="Handle"
          placeholder="@handle"
          value={handle}
          autoComplete="off"
          onChange={(event) => setHandle(event.target.value)}
          hint="We look up the writer as you type."
          error={notFound ? 'No writer with that handle.' : undefined}
        />

        {/* Resolution feedback, so it is unambiguous WHO is about to be invited. */}
        <p aria-live="polite" className="text-sm">
          {resolved.isFetching ? (
            <span className="text-ink-muted">Looking up…</span>
          ) : invitee ? (
            <span className="text-ink">
              Inviting <bdi className="font-medium">{invitee.penName}</bdi> (@{invitee.username})
            </span>
          ) : (
            <span className="text-ink-muted">Enter a handle to continue.</span>
          )}
        </p>

        <QSelect
          label="Role"
          aria-label="Role"
          value={role}
          options={ROLE_OPTIONS}
          // `unknown` from AntD's Select; `options` comes from ASSIGNABLE_STORY_ROLES.
          onChange={(next) => setRole(next as Role)}
          hint="A role can be changed later from the collaborators list."
        />

        {invite.isError ? (
          <p role="alert" className="text-danger text-sm">
            {inviteErrorMessage(invite.error)}
          </p>
        ) : null}
      </div>
    </QDialog>
  );
}

/**
 * The invite failures a writer can actually do something about get their own words; anything else
 * falls back to a generic line rather than leaking a server message into the UI.
 */
function inviteErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'The invitation could not be sent.';
  switch (error.code) {
    case ERROR_CODES.STORY_MEMBER_EXISTS:
      return 'They are already a collaborator on this story.';
    case ERROR_CODES.INVITATION_SELF:
      return 'You cannot invite yourself.';
    case ERROR_CODES.STORY_COLLABORATOR_LIMIT:
      return `A story can have at most ${MAX_STORY_COLLABORATORS} collaborators.`;
    case ERROR_CODES.STORY_ROLE_FORBIDDEN:
      return 'That role cannot be assigned.';
    default:
      return 'The invitation could not be sent.';
  }
}
