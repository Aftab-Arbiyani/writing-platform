import { SearchType } from '@qalam/shared';
import { QButton, QErrorState } from '@qalam/ui';
import { ArrowRight } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { getErrorMessage, getRequestId } from '@/lib/errors';
import { feedPath } from '@/lib/routes';

import { useGlobalSearch } from '../hooks/use-global-search';
import { NoResults } from './search-empty-states';
import { ResultListSkeleton } from './search-skeletons';
import { PieceResultCard } from './piece-result-card';
import { TaxonomyRow } from './taxonomy-row';
import { WriterListItem } from './writer-list-item';

/** A group heading with a "See all →" affordance that deep-links to that group's own tab. */
function GroupHeader({ title, onSeeAll }: { title: string; onSeeAll: () => void }): ReactElement {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-secondary">{title}</h2>
      <QButton variant="ghost" size="sm" icon={ArrowRight} iconPosition="end" onClick={onSeeAll}>
        See all
      </QButton>
    </div>
  );
}

function Group({ children }: { children: ReactNode }): ReactElement {
  return <section className="flex flex-col">{children}</section>;
}

/**
 * The "All" tab — the `GET /search` grouped relevance preview (docs/06 §3.6). Each non-empty
 * group shows its top-N with a "See all" that switches to the dedicated tab (deep pagination
 * lives there). Writers/pieces render their result cards; tags/genres/languages link into the
 * filtered Latest feed. All-empty falls to the shared literary no-results state.
 */
export function AllResults({
  q,
  onSeeAll,
}: {
  q: string;
  onSeeAll: (type: SearchType) => void;
}): ReactElement {
  const { data, isLoading, isError, error, refetch } = useGlobalSearch(q);

  if (isLoading) return <ResultListSkeleton count={4} />;

  if (isError) {
    return (
      <QErrorState
        title="Couldn't run that search."
        description={getErrorMessage(error)}
        requestId={getRequestId(error)}
        onRetry={() => void refetch()}
      />
    );
  }

  const writers = data?.writers ?? [];
  const pieces = data?.pieces ?? [];
  const tags = data?.tags ?? [];
  const genres = data?.genres ?? [];
  const languages = data?.languages ?? [];
  const isEmpty =
    writers.length === 0 &&
    pieces.length === 0 &&
    tags.length === 0 &&
    genres.length === 0 &&
    languages.length === 0;

  if (isEmpty) return <NoResults />;

  return (
    <div className="flex flex-col gap-8">
      {writers.length > 0 ? (
        <Group>
          <GroupHeader title="Writers" onSeeAll={() => onSeeAll(SearchType.Writers)} />
          <ul className="flex flex-col gap-3">
            {writers.map((writer) => (
              <li key={writer.userId}>
                <WriterListItem writer={writer} />
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      {pieces.length > 0 ? (
        <Group>
          <GroupHeader title="Pieces" onSeeAll={() => onSeeAll(SearchType.Pieces)} />
          <ul className="flex flex-col gap-3">
            {pieces.map((piece) => (
              <li key={piece.id}>
                <PieceResultCard piece={piece} query={q} />
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      {tags.length > 0 ? (
        <Group>
          <GroupHeader title="Tags" onSeeAll={() => onSeeAll(SearchType.Tags)} />
          <ul className="flex flex-col gap-3">
            {tags.map((tag) => (
              <li key={tag.slug}>
                <TaxonomyRow
                  href={feedPath({ tab: 'latest', tag: tag.slug })}
                  title={`#${tag.name}`}
                  query={q}
                  count={tag.pieceCount}
                  countNoun="piece"
                />
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      {genres.length > 0 ? (
        <Group>
          <GroupHeader title="Genres" onSeeAll={() => onSeeAll(SearchType.Genres)} />
          <ul className="flex flex-col gap-3">
            {genres.map((genre) => (
              <li key={genre.slug}>
                <TaxonomyRow
                  href={feedPath({ tab: 'latest', genre: genre.slug })}
                  title={genre.name}
                  query={q}
                  count={genre.pieceCount}
                  countNoun="piece"
                />
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      {languages.length > 0 ? (
        <Group>
          <GroupHeader title="Languages" onSeeAll={() => onSeeAll(SearchType.Languages)} />
          <ul className="flex flex-col gap-3">
            {languages.map((language) => (
              <li key={language.code}>
                <TaxonomyRow
                  href={feedPath({ tab: 'latest', lang: language.code })}
                  title={language.nativeName}
                  query={q}
                  count={language.pieceCount}
                  countNoun="piece"
                />
              </li>
            ))}
          </ul>
        </Group>
      ) : null}
    </div>
  );
}
