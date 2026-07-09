import { QAvatar } from '@qalam/ui';
import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router';

import { mediaUrl } from '@/lib/media';
import { profilePath } from '@/lib/routes';
import type { UserSummary } from '@/types/profile';

/**
 * One writer row for followers / following / request lists (docs/06 §3.5). Avatar + pen name
 * (bidi-isolated) + `@username` (always LTR in a `<bdi>`, docs/06 §6). The whole identity is a
 * link to the writer's profile; an optional `trailing` slot carries actions (e.g. accept/reject).
 */
export function UserSummaryRow({
  user,
  trailing,
}: {
  user: UserSummary;
  trailing?: ReactNode;
}): ReactElement {
  const name = user.penName ?? user.username;
  return (
    <li className="flex items-center gap-3 py-2">
      <Link
        to={profilePath(user.username)}
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <QAvatar size="md" src={mediaUrl(user.avatarKey)} name={name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink group-hover:underline">
            <bdi>{name}</bdi>
          </span>
          <span dir="ltr" className="block truncate text-sm text-ink-secondary">
            <bdi>@{user.username}</bdi>
          </span>
        </span>
      </Link>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </li>
  );
}
