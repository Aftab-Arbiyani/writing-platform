import { QAvatar, QButton } from '@qalam/ui';
import { FileText, MapPin, Pencil } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { mediaUrl } from '@/lib/media';
import { ROUTES } from '@/lib/routes';
import type { ProfileResponse } from '@/types/profile';

import { FollowButton } from './follow-button';
import { ProfileStats } from './profile-stats';

/**
 * Profile header (docs/06 §3.5): optional 3:1 cover strip, 80px avatar overlapping it, pen name
 * (the display name, bidi-isolated), `@username` (always LTR), bio (≤3 lines), location, and the
 * stat line. Self sees Edit profile + Your writing; others see the Follow button. Cover/avatar
 * are S3 keys → `mediaUrl()`, `loading="lazy"`, explicit ratio (no layout shift), dark dims to
 * `brightness(0.92)` (docs/06 §11.3). All physical directions use logical props for RTL.
 */
export function ProfileHeader({
  profile,
  onOpenFollowers,
  onOpenFollowing,
}: {
  profile: ProfileResponse;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
}): ReactElement {
  const coverUrl = mediaUrl(profile.coverKey);
  const isSelf = profile.viewerRelation.isSelf;

  return (
    <header>
      {/* Cover strip — 3:1; a neutral band when there is no cover so the avatar overlap is stable. */}
      <div className="aspect-[3/1] w-full overflow-hidden bg-raised">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            width={1200}
            height={400}
            loading="lazy"
            className="h-full w-full object-cover dark:brightness-[0.92]"
          />
        ) : null}
      </div>

      <div className="mx-auto w-full max-w-[760px] px-4 sm:px-6">
        {/* Avatar overlaps the cover bottom; actions sit on the trailing edge. */}
        <div className="-mt-10 flex items-end justify-between gap-3 sm:-mt-12">
          <span className="rounded-full ring-4 ring-canvas">
            <QAvatar
              size={80}
              src={mediaUrl(profile.avatarKey)}
              name={profile.penName}
              className="dark:brightness-[0.92]"
            />
          </span>
          <div className="mb-1 flex items-center gap-2">
            {isSelf ? (
              <>
                <Link to={ROUTES.drafts} aria-label="Your writing">
                  <QButton
                    variant="ghost"
                    size="sm"
                    icon={FileText}
                    className="hidden sm:inline-flex"
                  >
                    Your writing
                  </QButton>
                </Link>
                <Link to={ROUTES.settingsProfile} aria-label="Edit profile">
                  <QButton variant="secondary" size="sm" icon={Pencil}>
                    Edit profile
                  </QButton>
                </Link>
              </>
            ) : (
              <FollowButton profile={profile} />
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <div>
            <h1 className="font-serif text-2xl font-semibold leading-tight text-ink">
              <bdi>{profile.penName}</bdi>
            </h1>
            <p dir="ltr" className="text-sm text-ink-secondary">
              <bdi>@{profile.username}</bdi>
            </p>
          </div>

          {profile.bio ? (
            <p dir="auto" className="line-clamp-3 max-w-prose whitespace-pre-line text-ink">
              {profile.bio}
            </p>
          ) : null}

          {profile.location ? (
            <p className="flex items-center gap-1 text-sm text-ink-secondary">
              <MapPin size={16} strokeWidth={1.5} aria-hidden />
              <bdi>{profile.location}</bdi>
            </p>
          ) : null}

          <ProfileStats
            counts={profile.counts}
            onOpenFollowers={onOpenFollowers}
            onOpenFollowing={onOpenFollowing}
            interactive={!profile.restricted}
          />
        </div>
      </div>
    </header>
  );
}
