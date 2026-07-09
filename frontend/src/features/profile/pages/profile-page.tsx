import { QErrorState, QSkeleton } from '@qalam/ui';
import { useState, type ReactElement } from 'react';
import { useSearchParams } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage, getRequestId, isApiError } from '@/lib/errors';

import { ProfileAbout } from '../components/profile-about';
import {
  FollowConnectionsDialog,
  type ConnectionsTab,
} from '../components/follow-connections-dialog';
import { ProfileHeader } from '../components/profile-header';
import { ProfilePiecesList } from '../components/profile-pieces-list';
import { ProfileTabs } from '../components/profile-tabs';
import { PrivateNotebook } from '../components/private-notebook';
import { useProfile } from '../hooks/use-profile';
import type { ProfileTab } from '../types/profile.types';

/**
 * A writer profile at `/@:username` (docs/06 §3.5, docs/11 §10). One page serves both the viewer's
 * own profile (Edit + drafts) and other writers (Follow), branching on `viewerRelation.isSelf`
 * from the response. A private account viewed by a stranger arrives `restricted` — header + lock,
 * no tabs. `?tab=` owns the Pieces/About selection; a dialog shows followers/following.
 */
export function ProfilePage({ username }: { username: string }): ReactElement {
  const query = useProfile(username);
  const [params, setParams] = useSearchParams();
  const tab: ProfileTab = params.get('tab') === 'about' ? 'about' : 'pieces';
  const [connections, setConnections] = useState<ConnectionsTab | null>(null);

  const profile = query.data;
  usePageTitle(profile ? `${profile.penName} (@${profile.username})` : 'Profile');

  const selectTab = (next: ProfileTab): void => {
    setParams(
      (prev) => {
        const search = new URLSearchParams(prev);
        if (next === 'pieces') search.delete('tab');
        else search.set('tab', next);
        return search;
      },
      { replace: true },
    );
  };

  if (query.isLoading) {
    return (
      <div role="status" aria-busy="true" aria-label="Loading profile">
        <QSkeleton variant="rect" height={200} radius="sm" className="w-full" />
        <div className="mx-auto w-full max-w-[760px] px-4 sm:px-6">
          <div className="-mt-10 flex items-end gap-3">
            <QSkeleton variant="avatar" avatarSize={80} />
          </div>
          <div className="mt-3">
            <QSkeleton variant="title" width="40%" />
            <QSkeleton variant="text" lines={2} width="70%" className="mt-3" />
          </div>
        </div>
      </div>
    );
  }

  if (query.isError || !profile) {
    const notFound = isApiError(query.error) && query.error.status === 404;
    return (
      <div className="mx-auto w-full max-w-[760px] px-4 py-12 sm:px-6">
        <QErrorState
          title={notFound ? 'We couldn’t find that writer.' : 'Couldn’t load this profile.'}
          description={
            notFound
              ? 'The handle may be misspelled, or the writer may have left Qalam.'
              : getErrorMessage(query.error)
          }
          requestId={getRequestId(query.error)}
          onRetry={
            notFound
              ? undefined
              : () => {
                  void query.refetch();
                }
          }
        />
      </div>
    );
  }

  return (
    <div className="pb-10">
      <ProfileHeader
        profile={profile}
        onOpenFollowers={() => setConnections('followers')}
        onOpenFollowing={() => setConnections('following')}
      />

      <div className="mx-auto mt-4 w-full max-w-[760px] px-4 sm:px-6">
        {profile.restricted ? (
          <PrivateNotebook />
        ) : (
          <>
            <ProfileTabs active={tab} onSelect={selectTab} />
            <div className="mt-4">
              {tab === 'pieces' ? (
                <ProfilePiecesList profile={profile} />
              ) : (
                <ProfileAbout profile={profile} />
              )}
            </div>
          </>
        )}
      </div>

      <FollowConnectionsDialog
        open={connections !== null}
        onClose={() => setConnections(null)}
        username={profile.username}
        penName={profile.penName}
        tab={connections ?? 'followers'}
        onTabChange={setConnections}
      />
    </div>
  );
}
