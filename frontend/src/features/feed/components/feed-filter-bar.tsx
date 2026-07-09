import { FeedSort } from '@qalam/shared';
import { QButton, QSelect } from '@qalam/ui';
import { RefreshCw, X } from 'lucide-react';
import type { ReactElement } from 'react';

import { useFeedLanguages, useTrendingGenres } from '../hooks/use-discover';
import type { ReadingTimePreset, UseFeedParamsResult } from '../hooks/use-feed-params';

const SORT_OPTIONS: readonly { value: FeedSort; label: string }[] = [
  { value: FeedSort.Latest, label: 'Latest' },
  { value: FeedSort.Trending, label: 'Trending' },
  { value: FeedSort.MostClapped, label: 'Most clapped' },
  { value: FeedSort.MostDiscussed, label: 'Most discussed' },
];

const READING_TIME_OPTIONS: readonly { value: ReadingTimePreset; label: string }[] = [
  { value: 'short', label: 'Under 5 min' },
  { value: 'medium', label: '5–15 min' },
  { value: 'long', label: 'Over 15 min' },
];

const SELECT_STYLE = { minWidth: 148 } as const;

/**
 * Feed filter bar — Language, Genre, Reading time, Sort (docs/06 §3.1; the prompt's filter set).
 * Every control maps to a `FeedQueryDto` param and lives in the URL (via `useFeedParams`), so
 * a filtered feed is shareable. Options come from the backend (`/discover/languages`,
 * `/discover/genres`) — never a hard-coded list. Sort is hidden on the Trending tab (the server
 * fixes the order there). Includes a manual refresh (docs/06 §4.2). Wraps responsively; controls
 * grow to ≥44px touch targets below lg via AntD's `large`-ish sizing.
 */
export function FeedFilterBar({
  params,
  onRefresh,
  isRefreshing,
}: {
  params: UseFeedParamsResult;
  onRefresh: () => void;
  isRefreshing: boolean;
}): ReactElement {
  const languages = useFeedLanguages();
  const genres = useTrendingGenres();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <QSelect
        aria-label="Filter by language"
        placeholder="Language"
        allowClear
        loading={languages.isLoading}
        style={SELECT_STYLE}
        value={params.language ?? undefined}
        onChange={(value) => {
          params.setLanguage(typeof value === 'string' ? value : null);
        }}
        options={(languages.data ?? []).map((l) => ({ value: l.code, label: l.nativeName }))}
      />

      <QSelect
        aria-label="Filter by genre"
        placeholder="Genre"
        allowClear
        loading={genres.isLoading}
        style={SELECT_STYLE}
        value={params.genre ?? undefined}
        onChange={(value) => {
          params.setGenre(typeof value === 'string' ? value : null);
        }}
        options={(genres.data ?? []).map((g) => ({ value: g.slug, label: g.name }))}
      />

      <QSelect
        aria-label="Filter by reading time"
        placeholder="Reading time"
        allowClear
        style={SELECT_STYLE}
        value={params.readingTime ?? undefined}
        onChange={(value) => {
          params.setReadingTime(typeof value === 'string' ? (value as ReadingTimePreset) : null);
        }}
        options={READING_TIME_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      />

      {params.tab !== 'trending' ? (
        <QSelect
          aria-label="Sort order"
          style={SELECT_STYLE}
          value={params.sort}
          onChange={(value) => {
            if (typeof value === 'string') params.setSort(value as FeedSort);
          }}
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
      ) : null}

      <div className="ms-auto flex items-center gap-1">
        {params.hasActiveFilters ? (
          <QButton variant="ghost" size="sm" icon={X} onClick={params.clearFilters}>
            Clear
          </QButton>
        ) : null}
        <QButton
          variant="ghost"
          size="sm"
          icon={RefreshCw}
          loading={isRefreshing}
          onClick={onRefresh}
          aria-label="Refresh feed"
        />
      </div>
    </div>
  );
}
