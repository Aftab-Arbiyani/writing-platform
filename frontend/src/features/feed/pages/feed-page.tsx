import type { ReactElement } from 'react';

import { Seo } from '@/components/seo';
import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';

import { FeedFilterBar } from '../components/feed-filter-bar';
import { FeedList } from '../components/feed-list';
import { FeedRail } from '../components/feed-rail';
import { FeedSkeleton } from '../components/feed-skeleton';
import { FeedTabs } from '../components/feed-tabs';
import { useFeed } from '../hooks/use-feed';
import { useFeedParams } from '../hooks/use-feed-params';

/**
 * The Home / Feed screen (docs/06 §3.1) — the authenticated reader's home (the landing route
 * redirects signed-in users here). Two columns at `lg`+ (main 680 + rail 320), a single
 * centered column below (rail content lives in Discover, docs/06 §8). Tab + filters are
 * URL-driven (`useFeedParams`); the feed itself is a cursor-paginated infinite query.
 */
export function FeedPage(): ReactElement {
  usePageTitle('Home');
  const status = useAuthStore((s) => s.status);
  const params = useFeedParams();

  const isBooting = status === 'unknown';
  const locked = params.tab === 'following' && status !== 'authenticated';
  // Defer fetching until boot resolves so the default tab (following vs discover) is settled.
  const query = useFeed(params.tab, params.filters, !isBooting && !locked);

  return (
    <div className="mx-auto grid w-full max-w-[1080px] gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,680px)_320px] lg:justify-center">
      <Seo
        title="Home"
        description="Your reading feed on Qalam — the latest and trending writing from voices you follow."
        canonicalPath={ROUTES.feed}
      />
      <div className="flex min-w-0 flex-col gap-4">
        {/* Page-level heading for SR/document outline; the feed's visual title is its tab strip. */}
        <h1 className="sr-only">Home</h1>
        <FeedTabs tab={params.tab} onSelect={params.setTab} />
        <FeedFilterBar
          params={params}
          onRefresh={() => {
            void query.refetch();
          }}
          isRefreshing={query.isRefetching}
        />
        {isBooting ? (
          <FeedSkeleton />
        ) : (
          <FeedList
            query={query}
            tab={params.tab}
            locked={locked}
            hasActiveFilters={params.hasActiveFilters}
            onClearFilters={params.clearFilters}
            onGoDiscover={() => {
              params.setTab('discover');
            }}
          />
        )}
      </div>
      <aside aria-label="Discover" className="hidden lg:block">
        <FeedRail />
      </aside>
    </div>
  );
}
