import { QEmptyState, QErrorState, QSkeleton, QSpinner } from '@qalam/ui';
import { UserPlus } from 'lucide-react';
import type { ReactElement } from 'react';

import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage, getRequestId } from '@/lib/errors';

import { FollowRequestRow } from '../components/follow-request-row';
import { useFollowRequests } from '../hooks/use-follow-requests';

/**
 * The follow-requests inbox (`/me/follow-requests`) — incoming pending requests to a private
 * account, each accept/reject-able (docs/06 §3.5, docs/26 §9). Cursor-infinite with the four
 * feedback states. Reached from the user menu; irrelevant to public accounts (which have none).
 */
export function FollowRequestsPage(): ReactElement {
  usePageTitle('Follow requests');
  const query = useFollowRequests();
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const sentinelRef = useInfiniteScroll({
    hasMore: query.hasNextPage ?? false,
    isLoading: query.isFetchingNextPage,
    onLoadMore: () => {
      void query.fetchNextPage();
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="font-serif text-2xl font-semibold text-ink">Follow requests</h1>

      {query.isLoading ? (
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading requests"
          className="flex flex-col gap-3"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <QSkeleton variant="avatar" avatarSize={48} />
              <div className="flex-1">
                <QSkeleton variant="title" width="40%" />
                <QSkeleton variant="text" lines={1} width="25%" className="mt-1" />
              </div>
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <QErrorState
          title="Couldn’t load your requests."
          description={getErrorMessage(query.error)}
          requestId={getRequestId(query.error)}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : items.length === 0 ? (
        <QEmptyState
          icon={UserPlus}
          title="No follow requests."
          description="When someone asks to follow your private notebook, they’ll wait here."
        />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line">
            {items.map((request) => (
              <FollowRequestRow key={request.id} request={request} />
            ))}
          </ul>
          <div ref={sentinelRef} aria-hidden className="h-px" />
          {query.isFetchingNextPage ? (
            <div role="status" aria-label="Loading more" className="flex justify-center py-3">
              <QSpinner />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
