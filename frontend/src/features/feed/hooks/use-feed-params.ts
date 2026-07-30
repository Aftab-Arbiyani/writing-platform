import { FeedSort } from '@qalam/shared';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import type { FeedFilters, FeedTab } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';

/**
 * The URL is the source of truth for the feed tab + filters (hard-rule #4, docs/11 §5, §10.1;
 * this supersedes the brief's "tab/filters in Zustand"). This hook reads/writes the search
 * params and resolves them into the `FeedFilters` the query key + api layer consume. Cursors
 * are NEVER in the URL (opaque; they live in the TanStack pageParam, docs/11 §5).
 */

const FEED_TABS: readonly FeedTab[] = ['following', 'latest', 'trending', 'discover'];
const FEED_SORTS = Object.values(FeedSort);

/** Reading-time presets → the `min/maxReadingTime` (seconds) the FeedQueryDto accepts. */
export const READING_TIME_PRESETS = {
  short: { maxReadingTime: 5 * 60 },
  medium: { minReadingTime: 5 * 60, maxReadingTime: 15 * 60 },
  long: { minReadingTime: 15 * 60 },
} as const;
export type ReadingTimePreset = keyof typeof READING_TIME_PRESETS;
const READING_TIME_VALUES = Object.keys(READING_TIME_PRESETS) as ReadingTimePreset[];

function isFeedTab(value: string | null): value is FeedTab {
  return value !== null && (FEED_TABS as readonly string[]).includes(value);
}
function isFeedSort(value: string | null): value is FeedSort {
  return value !== null && (FEED_SORTS as string[]).includes(value);
}
function isReadingTime(value: string | null): value is ReadingTimePreset {
  return value !== null && (READING_TIME_VALUES as string[]).includes(value);
}

export interface UseFeedParamsResult {
  tab: FeedTab;
  sort: FeedSort;
  language: string | null;
  genre: string | null;
  tag: string | null;
  readingTime: ReadingTimePreset | null;
  /** Resolved filters for the query key + api layer (only defined values). */
  filters: FeedFilters;
  hasActiveFilters: boolean;
  setTab: (tab: FeedTab) => void;
  setSort: (sort: FeedSort) => void;
  setLanguage: (code: string | null) => void;
  setGenre: (slug: string | null) => void;
  setReadingTime: (preset: ReadingTimePreset | null) => void;
  clearFilters: () => void;
}

export function useFeedParams(): UseFeedParamsResult {
  const [params, setParams] = useSearchParams();
  const status = useAuthStore((s) => s.status);

  // Default tab: followed writers for signed-in readers, editorial Discover for visitors.
  const defaultTab: FeedTab = status === 'authenticated' ? 'following' : 'discover';

  const tab = isFeedTab(params.get('tab')) ? (params.get('tab') as FeedTab) : defaultTab;
  const sort = isFeedSort(params.get('sort')) ? (params.get('sort') as FeedSort) : FeedSort.Latest;
  const language = params.get('lang');
  const genre = params.get('genre');
  const tag = params.get('tag');
  const readingTime = isReadingTime(params.get('read'))
    ? (params.get('read') as ReadingTimePreset)
    : null;

  const update = useCallback(
    (patch: Record<string, string | null>, { replace = false } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === '') next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace },
      );
    },
    [setParams],
  );

  const filters = useMemo<FeedFilters>(() => {
    const resolved: FeedFilters = {};
    if (language) resolved.language = language;
    if (genre) resolved.genre = genre;
    if (tag) resolved.tag = tag;
    if (tab !== 'trending') resolved.sort = sort;
    if (readingTime) Object.assign(resolved, READING_TIME_PRESETS[readingTime]);
    return resolved;
  }, [language, genre, tag, tab, sort, readingTime]);

  const hasActiveFilters = Boolean(
    language || genre || tag || readingTime || (tab !== 'trending' && sort !== FeedSort.Latest),
  );

  return {
    tab,
    sort,
    language,
    genre,
    tag,
    readingTime,
    filters,
    hasActiveFilters,
    // Tab is a navigation step (back button works, docs/06 §3.1) → push history.
    setTab: (value) => {
      update({ tab: value });
    },
    // Filter tweaks are refinements → replace history (no per-select clutter).
    setSort: (value) => {
      update({ sort: value }, { replace: true });
    },
    setLanguage: (value) => {
      update({ lang: value }, { replace: true });
    },
    setGenre: (value) => {
      update({ genre: value }, { replace: true });
    },
    setReadingTime: (value) => {
      update({ read: value }, { replace: true });
    },
    clearFilters: () => {
      update({ lang: null, genre: null, tag: null, read: null, sort: null }, { replace: true });
    },
  };
}
