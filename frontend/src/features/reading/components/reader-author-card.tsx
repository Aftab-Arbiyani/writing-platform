import { QAvatar, QCard } from '@qalam/ui';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { FollowButton } from '@/components/follow-button';
import { useProfile } from '@/hooks/use-profile';
import { formatCount } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import { profilePath } from '@/lib/routes';

/**
 * The reader's author card (W1, docs/45 §4.1) — the web analog of mobile's `reader_author_card`.
 * Loads the writer's public profile for the avatar, bio, follower count and the follow relation,
 * and offers the same optimistic Follow the profile page does (both share
 * `qk.profiles.detail(username)`, so following here updates there and vice versa).
 *
 * **Degrades, never blocks.** The article does not depend on this: while the profile loads, and
 * if it fails or the account is `restricted`, the card falls back to the byline the piece itself
 * carried and simply omits the follow affordance. A dead author card must not cost a reader the
 * piece they came for.
 */
export function ReaderAuthorCard({
  username,
  fallbackName,
}: {
  username: string;
  fallbackName: string;
}): ReactElement {
  const { data: profile } = useProfile(username);
  const name = profile?.penName ?? fallbackName;
  const followers = profile?.counts.followers;

  return (
    <QCard padding="lg" className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <QAvatar size={44} src={mediaUrl(profile?.avatarKey)} name={name} />
        <div className="min-w-0 flex-1">
          <Link to={profilePath(username)} className="font-medium text-ink hover:underline">
            <bdi>{name}</bdi>
          </Link>
          <p dir="ltr" className="truncate text-sm text-ink-muted">
            <bdi>@{username}</bdi>
            {followers === undefined ? null : (
              <>
                {' · '}
                {formatCount(followers)} {followers === 1 ? 'follower' : 'followers'}
              </>
            )}
          </p>
        </div>
        {profile ? <FollowButton profile={profile} size="sm" /> : null}
      </div>

      {profile?.bio ? (
        <p className="line-clamp-3 text-sm text-ink-secondary">{profile.bio}</p>
      ) : null}
    </QCard>
  );
}
