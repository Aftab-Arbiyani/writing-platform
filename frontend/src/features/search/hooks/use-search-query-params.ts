import { SearchSort, SearchType, SEARCH_QUERY_MIN } from '@qalam/shared';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import type { SearchFilters } from '@/lib/query-keys';

/**
 * The URL is the single source of truth for the search query, active tab, and every filter
 * (hard-rule #4, docs/06 §3.6 "all state in the URL", docs/11 §5) — this supersedes the brief's
 * "filters in Zustand". A shared `/search?q=…&type=…&genre=…` URL reproduces the exact results.
 * Cursors are NEVER in the URL (opaque; they ride the TanStack pageParam).
 *
 * Reading-time and publish-date are stored as stable PRESET keys (`read=short`, `date=week`) and
 * resolved to the numeric/ISO wire params here, so the URL stays short and shareable.
 */

const SEARCH_TYPES = Object.values(SearchType);
const SEARCH_SORTS = Object.values(SearchSort);

/** Reading-time presets → the `min/maxReadingTime` (seconds) SearchPiecesQueryDto accepts. */
export const READING_TIME_PRESETS = {
  short: { maxReadingTime: 5 * 60 },
  medium: { minReadingTime: 5 * 60, maxReadingTime: 15 * 60 },
  long: { minReadingTime: 15 * 60 },
} as const;
export type ReadingTimePreset = keyof typeof READING_TIME_PRESETS;
const READING_TIME_VALUES = Object.keys(READING_TIME_PRESETS) as ReadingTimePreset[];

/** Publish-date presets → a rolling `dateFrom` window (days back from today). */
export const DATE_PRESETS = {
  today: 0,
  week: 7,
  month: 30,
  year: 365,
} as const;
export type DatePreset = keyof typeof DATE_PRESETS;
const DATE_VALUES = Object.keys(DATE_PRESETS) as DatePreset[];

/** A stable date-only (YYYY-MM-DD) ISO string `days` before today — valid ISO-8601 for the DTO. */
function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function isSearchType(value: string | null): value is SearchType {
  return value !== null && (SEARCH_TYPES as string[]).includes(value);
}
function isSearchSort(value: string | null): value is SearchSort {
  return value !== null && (SEARCH_SORTS as string[]).includes(value);
}
function isReadingTime(value: string | null): value is ReadingTimePreset {
  return value !== null && (READING_TIME_VALUES as string[]).includes(value);
}
function isDatePreset(value: string | null): value is DatePreset {
  return value !== null && (DATE_VALUES as string[]).includes(value);
}

/**
 * Which engine answers the query (W5/AF4). `keyword` is the E8 full-text search this page has
 * always run; `ai` is the retrieval-backed one. In the URL (`mode=ai`) for the same reason every
 * other control is: a shared link has to reproduce the results, and the two engines answer
 * differently. `keyword` is the default and is omitted from the URL.
 */
export type SearchMode = 'keyword' | 'ai';

export interface UseSearchQueryParamsResult {
  /** Raw query as typed into the URL (may be empty / below the minimum). */
  q: string;
  /** True once `q` is long enough to hit the FTS endpoints (docs 05 §3.2 — 2 chars). */
  hasQuery: boolean;
  mode: SearchMode;
  type: SearchType;
  sort: SearchSort;
  language: string | null;
  genre: string | null;
  tag: string | null;
  readingTime: ReadingTimePreset | null;
  date: DatePreset | null;
  /** Resolved wire filters (only defined values) for the query key + api layer. */
  filters: SearchFilters;
  /** Whether any refining filter (not the query/tab) is active. */
  hasActiveFilters: boolean;

  setQuery: (q: string) => void;
  setMode: (mode: SearchMode) => void;
  setType: (type: SearchType) => void;
  setSort: (sort: SearchSort) => void;
  setLanguage: (code: string | null) => void;
  setGenre: (slug: string | null) => void;
  setTag: (slug: string | null) => void;
  setReadingTime: (preset: ReadingTimePreset | null) => void;
  setDate: (preset: DatePreset | null) => void;
  clearFilters: () => void;
}

export function useSearchQueryParams(): UseSearchQueryParamsResult {
  const [params, setParams] = useSearchParams();

  const q = params.get('q') ?? '';
  const mode: SearchMode = params.get('mode') === 'ai' ? 'ai' : 'keyword';
  const type = isSearchType(params.get('type'))
    ? (params.get('type') as SearchType)
    : SearchType.All;
  const sort = isSearchSort(params.get('sort'))
    ? (params.get('sort') as SearchSort)
    : SearchSort.Relevance;
  const language = params.get('lang');
  const genre = params.get('genre');
  const tag = params.get('tag');
  const readingTime = isReadingTime(params.get('read'))
    ? (params.get('read') as ReadingTimePreset)
    : null;
  const date = isDatePreset(params.get('date')) ? (params.get('date') as DatePreset) : null;

  const hasQuery = q.trim().length >= SEARCH_QUERY_MIN;

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

  const filters = useMemo<SearchFilters>(() => {
    const resolved: SearchFilters = {};
    if (language) resolved.language = language;
    if (genre) resolved.genre = genre;
    if (tag) resolved.tag = tag;
    // Relevance is the server default; only send an explicit sort when it differs.
    if (sort !== SearchSort.Relevance) resolved.sort = sort;
    if (readingTime) Object.assign(resolved, READING_TIME_PRESETS[readingTime]);
    if (date) resolved.dateFrom = isoDaysAgo(DATE_PRESETS[date]);
    return resolved;
  }, [language, genre, tag, sort, readingTime, date]);

  const hasActiveFilters = Boolean(
    language || genre || tag || readingTime || date || sort !== SearchSort.Relevance,
  );

  return {
    q,
    hasQuery,
    mode,
    type,
    sort,
    language,
    genre,
    tag,
    readingTime,
    date,
    filters,
    hasActiveFilters,
    // The query is the primary navigation act (each search is a history entry, docs/06 §3.6).
    setQuery: (value) => {
      update({ q: value });
    },
    // Switching engine is navigational: it is a different answer to the same question, and back
    // should return to the previous one rather than silently re-run it.
    setMode: (value) => {
      update({ mode: value === 'keyword' ? null : value });
    },
    // Switching tab is navigational too (back button returns to the prior tab).
    setType: (value) => {
      update({ type: value === SearchType.All ? null : value });
    },
    // Filter tweaks are refinements → replace history (no per-select clutter).
    setSort: (value) => {
      update({ sort: value === SearchSort.Relevance ? null : value }, { replace: true });
    },
    setLanguage: (value) => {
      update({ lang: value }, { replace: true });
    },
    setGenre: (value) => {
      update({ genre: value }, { replace: true });
    },
    setTag: (value) => {
      update({ tag: value }, { replace: true });
    },
    setReadingTime: (value) => {
      update({ read: value }, { replace: true });
    },
    setDate: (value) => {
      update({ date: value }, { replace: true });
    },
    clearFilters: () => {
      update(
        { lang: null, genre: null, tag: null, read: null, date: null, sort: null },
        { replace: true },
      );
    },
  };
}
