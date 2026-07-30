import { QAvatar } from '@qalam/ui';
import type { ReactElement } from 'react';

import { useProfile } from '@/hooks/use-profile';
import { mediaUrl } from '@/lib/media';

/**
 * A collaborator's avatar + name, resolved from a bare user id.
 *
 * **Why this component exists.** `MemberDto` / `InvitationDto` carry ids only — no username, pen
 * name, or avatar (docs/49 §5). Mobile hit the same wall and settled for showing the raw id
 * (`StoryMember.label`). The web surface resolves it instead, but the id is all we have to resolve
 * *from*, and `GET /users/:username` is keyed by USERNAME, not id — so there is no lookup that turns
 * an id into a profile.
 *
 * So this renders honestly: a short id fragment as the label, upgraded to the real pen name whenever
 * a `username` is known from context (the inviter/invitee of an invitation the viewer sent, or the
 * story author). Showing a truncated id beats showing a fabricated name, and beats an empty row.
 *
 * A by-id profile lookup would fix this properly for every surface — noted in the W3a report as the
 * one backend enabler this epic could justify, deliberately NOT built here (flow step 2 default is
 * none, and the epic is a client epic).
 */
export interface CollaboratorIdentityProps {
  userId: string;
  /** Known username, when the caller has one — then the real profile is fetched and shown. */
  username?: string;
  /** Marks the viewer's own row, which needs no lookup at all. */
  isSelf?: boolean;
  size?: 'sm' | 'md';
}

/** First and last four of a UUID — recognisable, and obviously an id rather than a name. */
function shortId(userId: string): string {
  return userId.length > 12 ? `${userId.slice(0, 4)}…${userId.slice(-4)}` : userId;
}

export function CollaboratorIdentity({
  userId,
  username,
  isSelf = false,
  size = 'sm',
}: CollaboratorIdentityProps): ReactElement {
  // Only fires when a username is genuinely known; shares `qk.profiles.detail` with the profile
  // page and the reader's author card, so it is usually a cache hit.
  const { data: profile } = useProfile(username ?? null);

  const label = isSelf
    ? 'You'
    : (profile?.penName ?? (username ? `@${username}` : shortId(userId)));

  return (
    <span className="flex items-center gap-2">
      <QAvatar size={size === 'sm' ? 32 : 48} name={label} src={mediaUrl(profile?.avatarKey)} />
      <span className="flex flex-col">
        <span className="text-ink text-sm font-medium">
          <bdi>{label}</bdi>
        </span>
        {profile?.username ? (
          <span className="text-ink-muted text-xs">@{profile.username}</span>
        ) : null}
      </span>
    </span>
  );
}
