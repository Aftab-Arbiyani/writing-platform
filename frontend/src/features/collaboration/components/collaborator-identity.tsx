import { QAvatar } from '@qalam/ui';
import type { ReactElement } from 'react';

import { mediaUrl } from '@/lib/media';

import { useCollaboratorIdentity } from '../hooks/use-collaborator-identity';

/**
 * A collaborator's avatar + name, resolved from a bare user id.
 *
 * **Why this component exists.** The collaboration DTOs carry ids only, so every surface that names
 * a person from one (comment author, reviewer, snapshot author, history actor, blocked person)
 * needed somewhere to turn an id into a profile. Since B3 (docs/45 §4) that somewhere is
 * `useCollaboratorIdentity`, which this component renders and which the presence bar shares — see
 * its docblock for the lookup, its cost, and why the short-id fallback stays.
 */
export interface CollaboratorIdentityProps {
  userId: string;
  /** Marks the viewer's own row, which needs no lookup at all. */
  isSelf?: boolean;
  size?: 'sm' | 'md';
}

export function CollaboratorIdentity({
  userId,
  isSelf = false,
  size = 'sm',
}: CollaboratorIdentityProps): ReactElement {
  const { label, profile } = useCollaboratorIdentity(userId, isSelf);

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
