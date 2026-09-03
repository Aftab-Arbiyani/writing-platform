import { SearchSort, SearchType } from '@qalam/shared';
import { QButton, QDrawer, QSelect } from '@qalam/ui';
import { SlidersHorizontal, X } from 'lucide-react';
import type { ReactElement } from 'react';

import { useDiscoverGenres, useDiscoverLanguages } from '../hooks/use-discover';
import type {
  DatePreset,
  ReadingTimePreset,
  UseSearchQueryParamsResult,
} from '../hooks/use-search-query-params';
import { useSearchStore } from '../stores/search.store';

/**
 * Search filters (docs/06 §3.6, the prompt's filter set) — every control maps to a
 * `SearchPiecesQueryDto` / `SearchWritersQueryDto` param and lives in the URL (via
 * `useSearchQueryParams`), so a filtered search is shareable. Options come from the backend
 * (`/discover/{languages,genres}`) — never a hard-coded list.
 *
 * Shown only on the Pieces + Writers tabs (taxonomy tabs take no filters). Pieces expose the full
 * set; Writers only Language + Genre (all the writer endpoint accepts). Desktop renders an inline
 * bar; mobile collapses to a "Filters" button opening a bottom sheet (docs/06 §11.2) whose open
 * state is the one bit of filter UI kept in Zustand.
 *
 * v1 gaps (never faked): the backend has no ascending ("Oldest") sort and no reads sort ("Most
 * read" — reading tracking is deferred to E5), so those two are omitted from the Sort menu.
 */

const SORT_OPTIONS: readonly { value: SearchSort; label: string }[] = [
  { value: SearchSort.Relevance, label: 'Most relevant' },
  { value: SearchSort.Latest, label: 'Newest' },
  { value: SearchSort.Trending, label: 'Trending' },
  { value: SearchSort.MostClapped, label: 'Most clapped' },
  { value: SearchSort.MostCommented, label: 'Most discussed' },
];

const READING_TIME_OPTIONS: readonly { value: ReadingTimePreset; label: string }[] = [
  { value: 'short', label: 'Under 5 min' },
  { value: 'medium', label: '5–15 min' },
  { value: 'long', label: 'Over 15 min' },
];

const DATE_OPTIONS: readonly { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Past week' },
  { value: 'month', label: 'Past month' },
  { value: 'year', label: 'Past year' },
];

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

function FilterControls({
  params,
  stacked,
}: {
  params: UseSearchQueryParamsResult;
  stacked: boolean;
}): ReactElement {
  const languages = useDiscoverLanguages();
  const genres = useDiscoverGenres();
  /**
   * Reading time, publish date and sort belong to the **Pieces scope only**, because the ranked
   * `All` results come from `SemanticSearchDto`, which accepts `language`, `genre` and `tags` and
   * nothing else (48 §3.9 W5-1). Rendering them on `All` would put three controls on screen that
   * silently do nothing — the objection the W5 parity sweep raised
   * ([48 §3.9 W5-11](../../../../../docs/48_PlatformParityRegister.md)), and it survives D5 unchanged
   * now that `All` is the ranked scope rather than a separate engine.
   */
  const isPieces = params.type === SearchType.Pieces;

  const controlStyle = stacked ? { width: '100%' } : { minWidth: 152 };
  const wrapClass = stacked ? 'flex flex-col gap-4' : 'flex flex-wrap items-center gap-2';

  return (
    <div className={wrapClass}>
      <QSelect
        label={stacked ? 'Language' : undefined}
        aria-label="Filter by language"
        placeholder="Language"
        allowClear
        loading={languages.isLoading}
        style={controlStyle}
        value={params.language ?? undefined}
        onChange={(value) => {
          params.setLanguage(asString(value) ?? null);
        }}
        options={(languages.data ?? []).map((l) => ({ value: l.code, label: l.nativeName }))}
      />

      <QSelect
        label={stacked ? 'Genre' : undefined}
        aria-label="Filter by genre"
        placeholder="Genre"
        allowClear
        loading={genres.isLoading}
        style={controlStyle}
        value={params.genre ?? undefined}
        onChange={(value) => {
          params.setGenre(asString(value) ?? null);
        }}
        options={(genres.data ?? []).map((g) => ({ value: g.slug, label: g.name }))}
      />

      {isPieces ? (
        <>
          <QSelect
            label={stacked ? 'Reading time' : undefined}
            aria-label="Filter by reading time"
            placeholder="Reading time"
            allowClear
            style={controlStyle}
            value={params.readingTime ?? undefined}
            onChange={(value) => {
              params.setReadingTime((asString(value) as ReadingTimePreset | undefined) ?? null);
            }}
            options={READING_TIME_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />

          <QSelect
            label={stacked ? 'Published' : undefined}
            aria-label="Filter by publish date"
            placeholder="Any time"
            allowClear
            style={controlStyle}
            value={params.date ?? undefined}
            onChange={(value) => {
              params.setDate((asString(value) as DatePreset | undefined) ?? null);
            }}
            options={DATE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />

          <QSelect
            label={stacked ? 'Sort' : undefined}
            aria-label="Sort results"
            style={controlStyle}
            value={params.sort}
            onChange={(value) => {
              const next = asString(value);
              if (next) params.setSort(next as SearchSort);
            }}
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </>
      ) : null}
    </div>
  );
}

export function SearchFilterBar({
  params,
}: {
  params: UseSearchQueryParamsResult;
}): ReactElement | null {
  const filterPanelOpen = useSearchStore((s) => s.filterPanelOpen);
  const openFilterPanel = useSearchStore((s) => s.openFilterPanel);
  const closeFilterPanel = useSearchStore((s) => s.closeFilterPanel);

  /**
   * Filters apply to `All`, `Pieces` and `Writers`. The remaining scopes (tags, genres, languages)
   * are lists of the filter dimensions themselves, so there is nothing left to narrow by.
   *
   * `All` is included because it is where the ranked search lives, and language/genre/tags are
   * exactly what it accepts. Before D5 that scope showed no bar at all — the ranked engine had no
   * tabs, so `type` stayed at its `all` default and this returned `null`, which made the filter
   * mapping W5-1 had corrected `api-types` for **unreachable on a normal ranked search**. Merging the
   * engines fixed that by construction: one scope list, and the bar renders against it.
   */
  if (
    params.type !== SearchType.All &&
    params.type !== SearchType.Pieces &&
    params.type !== SearchType.Writers
  )
    return null;

  const clearButton = params.hasActiveFilters ? (
    <QButton variant="ghost" size="sm" icon={X} onClick={params.clearFilters}>
      Clear
    </QButton>
  ) : null;

  return (
    <div>
      {/* Desktop: inline bar. */}
      <div className="hidden items-center gap-2 md:flex">
        <FilterControls params={params} stacked={false} />
        <div className="ms-auto">{clearButton}</div>
      </div>

      {/* Mobile: a Filters button opens the bottom sheet (its open state lives in Zustand). */}
      <div className="flex items-center justify-between md:hidden">
        <QButton variant="secondary" size="sm" icon={SlidersHorizontal} onClick={openFilterPanel}>
          Filters
        </QButton>
        {clearButton}
      </div>

      <QDrawer
        open={filterPanelOpen}
        onClose={closeFilterPanel}
        title="Filters"
        placement="bottom"
        width="auto"
      >
        <div className="flex flex-col gap-6">
          <FilterControls params={params} stacked />
          <div className="flex items-center justify-between border-line border-t pt-4">
            <QButton
              variant="ghost"
              onClick={params.clearFilters}
              disabled={!params.hasActiveFilters}
            >
              Clear all
            </QButton>
            <QButton variant="primary" onClick={closeFilterPanel}>
              Show results
            </QButton>
          </div>
        </div>
      </QDrawer>
    </div>
  );
}
