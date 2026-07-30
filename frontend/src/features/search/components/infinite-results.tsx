import { QErrorState, QSpinner } from '@qalam/ui';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ReactElement } from 'react';

import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { getErrorMessage, getRequestId } from '@/lib/errors';

import { NoResults } from './search-empty-states';

/**
 * The four-state shell every result list shares (docs/06 §10.1, §10.3 rule 4): loading
 * (skeleton), error (in-place panel + retry + requestId), empty (catalogue copy), success (the
 * items + a prefetching sentinel + a next-page spinner). Presentational — the caller flattens its
 * own infinite query's pages and passes `items` + the state flags, so this stays query-type-free.
 */
export interface InfiniteResultsProps<T> {
  items: T[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  ariaLabel: string;
  skeleton: ReactNode;
  renderItem: (item: T) => ReactNode;
  getKey: (item: T) => string;
  /** `ul` layout classes (default: a vertical gap-3 stack). */
  listClassName?: string;
  /** Empty-state copy + glyph. */
  emptyTitle: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
}

export function InfiniteResults<T>({
  items,
  isLoading,
  isError,
  error,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onRetry,
  ariaLabel,
  skeleton,
  renderItem,
  getKey,
  listClassName = 'flex flex-col gap-3',
  emptyTitle,
  emptyDescription,
  emptyIcon,
}: InfiniteResultsProps<T>): ReactElement {
  const sentinelRef = useInfiniteScroll({
    hasMore: hasNextPage,
    isLoading: isFetchingNextPage,
    onLoadMore,
  });

  if (isLoading) return <>{skeleton}</>;

  if (isError) {
    return (
      <QErrorState
        title="Couldn't run that search."
        description={getErrorMessage(error)}
        requestId={getRequestId(error)}
        onRetry={onRetry}
      />
    );
  }

  if (items.length === 0) {
    return <NoResults title={emptyTitle} description={emptyDescription} icon={emptyIcon} />;
  }

  return (
    <section aria-label={ariaLabel} className="flex flex-col gap-3">
      <ul className={listClassName}>
        {items.map((item) => (
          <li key={getKey(item)}>{renderItem(item)}</li>
        ))}
      </ul>

      {/* Sentinel: prefetches the next page ~800px before it scrolls into view (docs/06 §4.2). */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      {isFetchingNextPage ? (
        <div role="status" aria-label="Loading more results" className="flex justify-center py-4">
          <QSpinner />
        </div>
      ) : null}

      {!hasNextPage ? (
        <p className="py-6 text-center text-sm text-ink-muted">That&apos;s everything for now.</p>
      ) : null}
    </section>
  );
}
