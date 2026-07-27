import { QButton, useToast, type QButtonSize } from '@qalam/ui';
import { Check, Clock, UserPlus } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { useFollow } from '@/hooks/use-follow';
import { getErrorMessage } from '@/lib/errors';
import { profilePath, ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';
import type { ProfileResponse } from '@/types/profile';

/**
 * Follow / Following / Requested toggle (docs/06 §3.5, §4.1; docs/07 §7.1). Optimistic via
 * `useFollow` — the state flips instantly and reconciles on settle. `aria-pressed` reflects the
 * follow state (docs/07 §9). A private target's Follow sends a request → "Requested" (which can
 * be cancelled). An anonymous viewer is routed to sign-in (following needs a session). Never
 * rendered for the viewer's own profile.
 *
 * App-wide composite (docs/26 §10): the profile header and the reading view's author card
 * (W1, docs/45 §4.1) both render it, and a feature may never import another feature.
 */
export function FollowButton({
  profile,
  size = 'md',
}: {
  profile: ProfileResponse;
  size?: QButtonSize;
}): ReactElement | null {
  const status = useAuthStore((s) => s.status);
  const navigate = useNavigate();
  const toast = useToast();
  const { follow, unfollow } = useFollow(profile.username);
  const { isSelf, isFollowing, hasPendingRequest } = profile.viewerRelation;

  if (isSelf) return null;

  const busy = follow.isPending || unfollow.isPending;

  const cancel = (): void => {
    unfollow.mutate(profile.id, {
      onError: (err) => toast.error('Couldn’t update that', { description: getErrorMessage(err) }),
    });
  };

  if (isFollowing) {
    return (
      <QButton
        variant="secondary"
        size={size}
        icon={Check}
        loading={busy}
        aria-pressed
        title={`Unfollow ${profile.penName}`}
        onClick={() =>
          unfollow.mutate(profile.id, {
            onSuccess: () => toast.success(`Unfollowed ${profile.penName}`),
            onError: (err) =>
              toast.error('Couldn’t unfollow', { description: getErrorMessage(err) }),
          })
        }
      >
        Following
      </QButton>
    );
  }

  if (hasPendingRequest) {
    return (
      <QButton
        variant="secondary"
        size={size}
        icon={Clock}
        loading={busy}
        aria-pressed
        title="Cancel follow request"
        onClick={cancel}
      >
        Requested
      </QButton>
    );
  }

  return (
    <QButton
      variant="primary"
      size={size}
      icon={UserPlus}
      loading={busy}
      aria-pressed={false}
      onClick={() => {
        if (status !== 'authenticated') {
          void navigate(
            `${ROUTES.login}?returnTo=${encodeURIComponent(profilePath(profile.username))}`,
          );
          return;
        }
        follow.mutate(profile.id, {
          onError: (err) => toast.error('Couldn’t follow', { description: getErrorMessage(err) }),
        });
      }}
    >
      {profile.isPrivate ? 'Request to follow' : 'Follow'}
    </QButton>
  );
}
