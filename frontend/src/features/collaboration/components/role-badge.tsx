import { StoryRole } from '@qalam/shared';
import { QTag, type QTagColor } from '@qalam/ui';
import type { ReactElement } from 'react';

/**
 * A collaborator's story role as a tag (AF6, W3a) — mobile's `RoleBadge`.
 *
 * Colour tracks authority so the roster is scannable: the owner reads as accent, writing roles as
 * info, reviewing roles as neutral. It is **presentation only** — role never decides whether a
 * control renders; that is the capability map's job (docs/49 §3).
 */
const LABEL: Record<StoryRole, string> = {
  [StoryRole.Owner]: 'Owner',
  [StoryRole.CoAuthor]: 'Co-author',
  [StoryRole.Editor]: 'Editor',
  [StoryRole.Reviewer]: 'Reviewer',
  [StoryRole.BetaReader]: 'Beta reader',
};

const COLOR: Record<StoryRole, QTagColor> = {
  [StoryRole.Owner]: 'accent',
  [StoryRole.CoAuthor]: 'info',
  [StoryRole.Editor]: 'info',
  [StoryRole.Reviewer]: 'neutral',
  [StoryRole.BetaReader]: 'neutral',
};

export interface RoleBadgeProps {
  role: StoryRole | string;
}

/**
 * Unknown roles render their raw wire value rather than disappearing — the client tolerates
 * vocabulary the server adds later (additive-contract discipline), and a visible unknown label is
 * debuggable where a silently dropped badge is not.
 */
export function RoleBadge({ role }: RoleBadgeProps): ReactElement {
  const known = role in LABEL ? (role as StoryRole) : undefined;
  return (
    <QTag color={known ? COLOR[known] : 'neutral'} size="sm">
      {known ? LABEL[known] : role}
    </QTag>
  );
}
