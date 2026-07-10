import { QAvatar, QCard } from '@qalam/ui';
import { Lock } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import { Link } from 'react-router';

import { formatCount } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import { profilePath } from '@/lib/routes';

/**
 * A writer result / discovery card. The WHOLE card is a stretched link to the profile
 * (`/@username`) — where the Follow action lives — so search never imports the profile feature's
 * follow button (docs/26 §4 no cross-feature imports); one focus stop. Private accounts appear as
 * a name-only teaser with a lock (docs 13 §4.2); their `bio` is null and never fabricated.
 * `memo` because result lists grow long.
 */
export interface WriterListItemData {
  username: string;
  penName: string | null;
  avatarKey: string | null;
  bio: string | null;
  followersCount: number;
  piecesCount: number;
  isPrivate?: boolean;
}

export const WriterListItem = memo(function WriterListItem({
  writer,
}: {
  writer: WriterListItemData;
}): ReactElement {
  const displayName = writer.penName ?? `@${writer.username}`;

  return (
    <QCard as="article" interactive padding="md" className="relative flex items-start gap-3">
      <QAvatar size={48} src={mediaUrl(writer.avatarKey)} name={displayName} />
      <div className="min-w-0 flex-1">
        <h3 className="flex items-center gap-1.5 font-medium text-ink">
          <Link
            to={profilePath(writer.username)}
            className="truncate rounded-sm after:absolute after:inset-0 after:content-['']"
          >
            {displayName}
          </Link>
          {writer.isPrivate ? (
            <Lock
              size={13}
              strokeWidth={1.75}
              className="shrink-0 text-ink-muted"
              aria-label="Private account"
            />
          ) : null}
        </h3>
        <p className="truncate text-sm text-ink-muted">@{writer.username}</p>
        {writer.bio ? (
          <p dir="auto" className="mt-1 line-clamp-2 text-sm text-ink-secondary">
            {writer.bio}
          </p>
        ) : writer.isPrivate ? (
          <p className="mt-1 text-sm text-ink-muted">This writer keeps a private notebook.</p>
        ) : null}
        <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-ink-muted">
          <span>
            <span className="font-medium text-ink-secondary tabular-nums">
              {formatCount(writer.followersCount)}
            </span>{' '}
            followers
          </span>
          <span>
            <span className="font-medium text-ink-secondary tabular-nums">
              {formatCount(writer.piecesCount)}
            </span>{' '}
            pieces
          </span>
        </p>
      </div>
    </QCard>
  );
});
