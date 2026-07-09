import { QButton, QEmptyState, QErrorState, QSpinner } from '@qalam/ui';
import { fadeRise } from '@qalam/ui/motion';
import { motion } from 'framer-motion';
import { Compass, Feather, FileText, Flame, LogIn, PenLine, SearchX, Users } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { getErrorMessage, getRequestId } from '@/lib/errors';
import type { FeedTab } from '@/lib/query-keys';
import { ROUTES } from '@/lib/routes';

import type { useFeed } from '../hooks/use-feed';
import { FeedSkeleton } from './feed-skeleton';
import { PieceCard } from './piece-card';

const TAB_LABEL: Record<FeedTab, string> = {
  following: 'Following',
  trending: 'Trending',
  latest: 'Latest',
  discover: 'Discover',
};

interface FeedListProps {
  query: ReturnType<typeof useFeed>;
  tab: FeedTab;
  /** Following tab viewed while signed out — show a sign-in prompt instead of the list. */
  locked: boolean;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onGoDiscover: () => void;
}

function EmptyState({
  tab,
  hasActiveFilters,
  onClearFilters,
  onGoDiscover,
}: Pick<
  FeedListProps,
  'tab' | 'hasActiveFilters' | 'onClearFilters' | 'onGoDiscover'
>): ReactElement {
  if (hasActiveFilters) {
    return (
      <QEmptyState
        icon={SearchX}
        title="No pieces match these filters."
        description="Try widening or clearing them."
        action={
          <QButton variant="secondary" onClick={onClearFilters}>
            Clear filters
          </QButton>
        }
      />
    );
  }
  switch (tab) {
    case 'following':
      return (
        <QEmptyState
          icon={Users}
          title="Your feed is a blank page."
          description="Follow writers and their words will find you here."
          action={
            <QButton variant="primary" onClick={onGoDiscover}>
              Discover writers
            </QButton>
          }
        />
      );
    case 'trending':
      return (
        <QEmptyState
          icon={Flame}
          title="Nothing's trending yet."
          description="Check back soon, or explore the latest writing."
          action={
            <QButton variant="secondary" onClick={onGoDiscover}>
              Explore Discover
            </QButton>
          }
        />
      );
    case 'latest':
      return (
        <QEmptyState
          icon={FileText}
          title="No pieces yet."
          description="New writing will appear here as it's published."
        />
      );
    case 'discover':
      return (
        <QEmptyState
          icon={Compass}
          title="Nothing to discover yet."
          description="New writing will surface here soon."
        />
      );
  }
}

/**
 * The feed list — owns all four feedback states (docs/06 §10.1): loading (skeleton-first),
 * empty (catalogue copy per tab), error (in-place panel + retry + requestId), success (the
 * cards). Infinite scroll via the shared sentinel (§4.2), a spinner while fetching the next
 * page, and the literary end-cap when the feed is exhausted. Each card fades in on mount
 * (`fadeRise`; reduced-motion handled globally).
 */
export function FeedList({
  query,
  tab,
  locked,
  hasActiveFilters,
  onClearFilters,
  onGoDiscover,
}: FeedListProps): ReactElement {
  const navigate = useNavigate();
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  const sentinelRef = useInfiniteScroll({
    hasMore: query.hasNextPage ?? false,
    isLoading: query.isFetchingNextPage,
    onLoadMore: () => {
      void query.fetchNextPage();
    },
  });

  if (locked) {
    return (
      <QEmptyState
        icon={LogIn}
        title="Sign in to see your feed."
        description="Follow writers and their words will find you here."
        action={
          <QButton
            variant="primary"
            onClick={() => {
              void navigate(ROUTES.login);
            }}
          >
            Sign in
          </QButton>
        }
      />
    );
  }

  if (query.isLoading) return <FeedSkeleton />;

  if (query.isError) {
    return (
      <QErrorState
        title="Couldn't load the feed."
        description={getErrorMessage(query.error)}
        requestId={getRequestId(query.error)}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        tab={tab}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        onGoDiscover={onGoDiscover}
      />
    );
  }

  return (
    <section aria-label={`${TAB_LABEL[tab]} feed`} className="flex flex-col gap-4">
      <ul className="flex flex-col gap-4">
        {items.map((piece) => (
          <motion.li key={piece.id} variants={fadeRise} initial="initial" animate="animate">
            <PieceCard piece={piece} />
          </motion.li>
        ))}
      </ul>

      {/* Sentinel: fetches the next page ~800px before it scrolls into view (§4.2). */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      {query.isFetchingNextPage ? (
        <div role="status" aria-label="Loading more" className="flex justify-center py-4">
          <QSpinner />
        </div>
      ) : null}

      {!query.hasNextPage ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Feather size={22} strokeWidth={1.5} className="text-ink-muted" aria-hidden />
          <p className="max-w-[36ch] text-sm text-ink-secondary">
            You&apos;ve read it all. The rest is unwritten — perhaps by you.
          </p>
          <QButton
            variant="secondary"
            icon={PenLine}
            onClick={() => {
              void navigate(ROUTES.write);
            }}
          >
            Write something
          </QButton>
        </div>
      ) : null}
    </section>
  );
}
