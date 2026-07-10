import { FileText, Hash, Languages, Tag, Users } from 'lucide-react';
import type { ReactElement } from 'react';

import type { SearchFilters } from '@/lib/query-keys';
import { feedPath } from '@/lib/routes';

import {
  useSearchGenres,
  useSearchLanguages,
  useSearchPieces,
  useSearchTags,
  useSearchWriters,
} from '../hooks/use-search-results';
import { InfiniteResults } from './infinite-results';
import { PieceResultCard } from './piece-result-card';
import { ResultListSkeleton, TaxonomyListSkeleton } from './search-skeletons';
import { TaxonomyRow } from './taxonomy-row';
import { WriterListItem } from './writer-list-item';

/**
 * The per-tab result lists (E8). Each owns exactly one infinite query and is mounted only while
 * its tab is active (the dispatcher in `SearchResults` swaps them), so the rules of hooks hold
 * and every list is strictly typed — no unions. Pages are flattened here; the shared
 * `InfiniteResults` shell renders the loading/error/empty/success states.
 */

export function PieceResults({ q, filters }: { q: string; filters: SearchFilters }): ReactElement {
  const query = useSearchPieces(q, filters);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <InfiniteResults
      items={items}
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      hasNextPage={query.hasNextPage ?? false}
      isFetchingNextPage={query.isFetchingNextPage}
      onLoadMore={() => void query.fetchNextPage()}
      onRetry={() => void query.refetch()}
      ariaLabel="Piece results"
      skeleton={<ResultListSkeleton />}
      renderItem={(piece) => <PieceResultCard piece={piece} query={q} />}
      getKey={(piece) => piece.id}
      emptyIcon={FileText}
      emptyTitle="No pieces found."
    />
  );
}

export function WriterResults({ q, filters }: { q: string; filters: SearchFilters }): ReactElement {
  const query = useSearchWriters(q, filters);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <InfiniteResults
      items={items}
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      hasNextPage={query.hasNextPage ?? false}
      isFetchingNextPage={query.isFetchingNextPage}
      onLoadMore={() => void query.fetchNextPage()}
      onRetry={() => void query.refetch()}
      ariaLabel="Writer results"
      skeleton={<ResultListSkeleton />}
      renderItem={(writer) => <WriterListItem writer={writer} />}
      getKey={(writer) => writer.userId}
      emptyIcon={Users}
      emptyTitle="No writers found."
      emptyDescription="Try a name, a pen name, or an @username."
    />
  );
}

export function TagResults({ q }: { q: string }): ReactElement {
  const query = useSearchTags(q);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <InfiniteResults
      items={items}
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      hasNextPage={query.hasNextPage ?? false}
      isFetchingNextPage={query.isFetchingNextPage}
      onLoadMore={() => void query.fetchNextPage()}
      onRetry={() => void query.refetch()}
      ariaLabel="Tag results"
      skeleton={<TaxonomyListSkeleton />}
      renderItem={(tag) => (
        <TaxonomyRow
          href={feedPath({ tab: 'latest', tag: tag.slug })}
          title={`#${tag.name}`}
          query={q}
          count={tag.pieceCount}
          countNoun="piece"
        />
      )}
      getKey={(tag) => tag.slug}
      emptyIcon={Hash}
      emptyTitle="No tags found."
    />
  );
}

export function GenreResults({ q }: { q: string }): ReactElement {
  const query = useSearchGenres(q);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <InfiniteResults
      items={items}
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      hasNextPage={query.hasNextPage ?? false}
      isFetchingNextPage={query.isFetchingNextPage}
      onLoadMore={() => void query.fetchNextPage()}
      onRetry={() => void query.refetch()}
      ariaLabel="Genre results"
      skeleton={<TaxonomyListSkeleton />}
      renderItem={(genre) => (
        <TaxonomyRow
          href={feedPath({ tab: 'latest', genre: genre.slug })}
          title={genre.name}
          query={q}
          count={genre.pieceCount}
          countNoun="piece"
        />
      )}
      getKey={(genre) => genre.slug}
      emptyIcon={Tag}
      emptyTitle="No genres found."
    />
  );
}

export function LanguageResults({ q }: { q: string }): ReactElement {
  const query = useSearchLanguages(q);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <InfiniteResults
      items={items}
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      hasNextPage={query.hasNextPage ?? false}
      isFetchingNextPage={query.isFetchingNextPage}
      onLoadMore={() => void query.fetchNextPage()}
      onRetry={() => void query.refetch()}
      ariaLabel="Language results"
      skeleton={<TaxonomyListSkeleton />}
      renderItem={(language) => (
        <TaxonomyRow
          href={feedPath({ tab: 'latest', lang: language.code })}
          title={language.nativeName}
          query={q}
          count={language.pieceCount}
          countNoun="piece"
        />
      )}
      getKey={(language) => language.code}
      emptyIcon={Languages}
      emptyTitle="No languages found."
    />
  );
}
