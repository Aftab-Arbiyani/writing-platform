import { QEmptyState, QErrorState, QSkeleton, QSpinner } from '@qalam/ui';
import { Users } from 'lucide-react';
import type { ReactElement } from 'react';

import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { getErrorMessage, getRequestId } from '@/lib/errors';

import type { useFollowers } from '../hooks/use-follow-lists';
import { UserSummaryRow } from './user-summary-row';

/**
 * Presentational followers / following list — all four feedback states (loading / empty / error /
 * data) plus infinite scroll (docs/06 §10.1). Decoupled from which hook feeds it; the dialog
 * passes the `useFollowers`/`useFollowing` result (identical shape) + the empty copy.
 */
export function FollowList({
  query,
  emptyTitle,
  emptyDescription,
}: {
  query: ReturnType<typeof useFollowers>;
  emptyTitle: string;
  emptyDescription: string;
}): ReactElement {
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const sentinelRef = useInfiniteScroll({
    hasMore: query.hasNextPage ?? false,
    isLoading: query.isFetchingNextPage,
    onLoadMore: () => {
      void query.fetchNextPage();
    },
  });

  if (query.isLoading) {
    return (
      <div role="status" aria-busy="true" aria-label="Loading" className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <QSkeleton variant="avatar" avatarSize={48} />
            <div className="flex-1">
              <QSkeleton variant="title" width="40%" />
              <QSkeleton variant="text" lines={1} width="25%" className="mt-1" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <QErrorState
        title="Couldn’t load this list."
        description={getErrorMessage(query.error)}
        requestId={getRequestId(query.error)}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  if (items.length === 0) {
    return <QEmptyState icon={Users} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-line">
        {items.map((user) => (
          <UserSummaryRow key={user.id} user={user} />
        ))}
      </ul>
      <div ref={sentinelRef} aria-hidden className="h-px" />
      {query.isFetchingNextPage ? (
        <div role="status" aria-label="Loading more" className="flex justify-center py-3">
          <QSpinner />
        </div>
      ) : null}
    </>
  );
}
