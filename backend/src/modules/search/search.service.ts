import { Injectable, Logger } from '@nestjs/common';
import { SEARCH_QUERY_MIN, SearchSort, SearchType } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';
import { buildCursorPage } from '../../common/pagination/pagination.helper';
import type { CursorPage } from '../../common/types/paginated-result';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import type { AutocompleteQueryDto } from './dto/autocomplete-query.dto';
import type { AutocompleteResultDto } from './dto/autocomplete-result.dto';
import type { RecentSearchDto } from './dto/recent-search.dto';
import type { SearchPiecesQueryDto } from './dto/search-pieces-query.dto';
import type { SearchQueryDto } from './dto/search-query.dto';
import type {
  GlobalSearchResultDto,
  SearchGenreDto,
  SearchLanguageDto,
  SearchPieceDto,
  SearchTagDto,
  SearchWriterDto,
} from './dto/search-result.dto';
import type { SearchTaxonomyQueryDto } from './dto/search-taxonomy-query.dto';
import type { SearchWritersQueryDto } from './dto/search-writers-query.dto';
import type { TrendingQueryDto } from './dto/trending-query.dto';
import type { TrendingSearchesDto } from './dto/trending.dto';
import { SEARCH_CACHE_KEYS, SEARCH_CACHE_TTL } from './search.constants';
import { SearchQueryTooShortException, SearchUnavailableException } from './search.exceptions';
import {
  genreCursorKey,
  languageCursorKey,
  pieceCursorKey,
  tagCursorKey,
  toGenreSuggestion,
  toPieceSuggestion,
  toRecentSearch,
  toSearchGenre,
  toSearchLanguage,
  toSearchPiece,
  toSearchTag,
  toSearchWriter,
  toTagSuggestion,
  toTrendingKeyword,
  toTrendingWriter,
  toWriterSuggestion,
  writerCursorKey,
} from './search.mappers';
import { SearchCacheService } from './search-cache.service';
import { SearchHistoryRepository } from './search-history.repository';
import type { ResolvedPieceFilters } from './search.repository';
import { SearchRepository } from './search.repository';
import { SearchRecentNotFoundException } from './search.exceptions';
import { normalizeSearchQuery, parseSearchCursor, splitCsv } from './search.util';

/** The authenticated principal on optional-auth search routes (id only needed). */
type Viewer = { id: string } | null;

/**
 * The search engine (E8) behind a single service surface — the ADR-designated
 * Meilisearch extraction seam (docs 02 §6.4). Orchestrates Postgres FTS
 * (relevance-ranked, cursor-paginated), autocomplete + trending (Redis-cached),
 * and per-user recent-search history. Visibility is enforced in the repository
 * (published + public + non-private author); this layer resolves filters via
 * `TaxonomyService`, records search analytics, and maps rows to DTOs.
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly repo: SearchRepository,
    private readonly history: SearchHistoryRepository,
    private readonly cache: SearchCacheService,
    private readonly taxonomy: TaxonomyService,
  ) {}

  // ── Global (grouped) search ─────────────────────────────────────────────

  async globalSearch(query: SearchQueryDto, viewer: Viewer): Promise<GlobalSearchResultDto> {
    const q = this.requireQuery(query.q);
    const { type, limit } = query;
    const want = (t: SearchType): boolean => type === SearchType.All || type === t;

    const result = await this.run(async (): Promise<GlobalSearchResultDto> => {
      const [writers, pieces, tags, genres, languages] = await Promise.all([
        want(SearchType.Writers)
          ? this.repo.searchWriters(q, undefined, undefined, null, limit)
          : Promise.resolve([]),
        want(SearchType.Pieces)
          ? this.repo.searchPieces(q, {}, SearchSort.Relevance, null, limit)
          : Promise.resolve([]),
        want(SearchType.Tags) ? this.repo.searchTags(q, null, limit) : Promise.resolve([]),
        want(SearchType.Genres) ? this.repo.searchGenres(q, null, limit) : Promise.resolve([]),
        want(SearchType.Languages)
          ? this.repo.searchLanguages(q, null, limit)
          : Promise.resolve([]),
      ]);
      return {
        writers: writers.slice(0, limit).map(toSearchWriter),
        pieces: pieces.slice(0, limit).map(toSearchPiece),
        tags: tags.slice(0, limit).map(toSearchTag),
        genres: genres.slice(0, limit).map(toSearchGenre),
        languages: languages.slice(0, limit).map(toSearchLanguage),
      };
    });

    await this.record(viewer, q, type);
    return result;
  }

  // ── Piece search ─────────────────────────────────────────────────────────

  async searchPieces(
    query: SearchPiecesQueryDto,
    viewer: Viewer,
  ): Promise<CursorPage<SearchPieceDto>> {
    const q = this.requireQuery(query.q);
    const cursor = parseSearchCursor(query.cursor);
    const filters = await this.resolvePieceFilters(query);

    const page = await this.run(async () => {
      const rows = await this.repo.searchPieces(q, filters, query.sort, cursor, query.limit);
      return buildCursorPage(rows, query.limit, (row) => pieceCursorKey(row, query.sort));
    });

    await this.record(viewer, q, SearchType.Pieces);
    return { items: page.items.map(toSearchPiece), meta: page.meta };
  }

  // ── Writer search ──────────────────────────────────────────────────────────

  async searchWriters(
    query: SearchWritersQueryDto,
    viewer: Viewer,
  ): Promise<CursorPage<SearchWriterDto>> {
    const q = this.requireQuery(query.q);
    const cursor = parseSearchCursor(query.cursor);
    const languageId =
      query.language !== undefined
        ? await this.taxonomy.resolveLanguageCode(query.language.trim())
        : undefined;
    const genreSlug = query.genre?.trim().toLowerCase();

    const page = await this.run(async () => {
      const rows = await this.repo.searchWriters(q, languageId, genreSlug, cursor, query.limit);
      return buildCursorPage(rows, query.limit, writerCursorKey);
    });

    await this.record(viewer, q, SearchType.Writers);
    return { items: page.items.map(toSearchWriter), meta: page.meta };
  }

  // ── Tag / Genre / Language search (q optional → browse by popularity) ──────

  async searchTags(query: SearchTaxonomyQueryDto): Promise<CursorPage<SearchTagDto>> {
    const q = this.optionalQuery(query.q);
    const cursor = parseSearchCursor(query.cursor);
    const page = await this.run(async () => {
      const rows = await this.repo.searchTags(q, cursor, query.limit);
      return buildCursorPage(rows, query.limit, tagCursorKey);
    });
    return { items: page.items.map(toSearchTag), meta: page.meta };
  }

  async searchGenres(query: SearchTaxonomyQueryDto): Promise<CursorPage<SearchGenreDto>> {
    const q = this.optionalQuery(query.q);
    const cursor = parseSearchCursor(query.cursor);
    const page = await this.run(async () => {
      const rows = await this.repo.searchGenres(q, cursor, query.limit);
      return buildCursorPage(rows, query.limit, genreCursorKey);
    });
    return { items: page.items.map(toSearchGenre), meta: page.meta };
  }

  async searchLanguages(query: SearchTaxonomyQueryDto): Promise<CursorPage<SearchLanguageDto>> {
    const q = this.optionalQuery(query.q);
    const cursor = parseSearchCursor(query.cursor);
    const page = await this.run(async () => {
      const rows = await this.repo.searchLanguages(q, cursor, query.limit);
      return buildCursorPage(rows, query.limit, languageCursorKey);
    });
    return { items: page.items.map(toSearchLanguage), meta: page.meta };
  }

  // ── Autocomplete (cached) ──────────────────────────────────────────────────

  async autocomplete(query: AutocompleteQueryDto): Promise<AutocompleteResultDto> {
    const q = this.requireQuery(query.q);
    const { type, limit } = query;
    const key = SEARCH_CACHE_KEYS.autocomplete(type, limit, q);

    return this.cache.remember(key, SEARCH_CACHE_TTL.autocomplete, () =>
      this.run(async (): Promise<AutocompleteResultDto> => {
        const want = (t: SearchType): boolean => type === SearchType.All || type === t;
        const [writers, tags, genres, pieces] = await Promise.all([
          want(SearchType.Writers) ? this.repo.autocompleteWriters(q, limit) : Promise.resolve([]),
          want(SearchType.Tags) ? this.repo.autocompleteTags(q, limit) : Promise.resolve([]),
          want(SearchType.Genres) ? this.repo.autocompleteGenres(q, limit) : Promise.resolve([]),
          want(SearchType.Pieces) ? this.repo.autocompletePieces(q, limit) : Promise.resolve([]),
        ]);
        return {
          writers: writers.map(toWriterSuggestion),
          tags: tags.map(toTagSuggestion),
          genres: genres.map(toGenreSuggestion),
          pieces: pieces.map(toPieceSuggestion),
        };
      }),
    );
  }

  // ── Trending (cached) ──────────────────────────────────────────────────────

  async trending(query: TrendingQueryDto): Promise<TrendingSearchesDto> {
    const { limit } = query;
    const key = SEARCH_CACHE_KEYS.trending(limit);

    return this.cache.remember(key, SEARCH_CACHE_TTL.trending, () =>
      this.run(async (): Promise<TrendingSearchesDto> => {
        const [keywords, tags, genres, writers] = await Promise.all([
          this.history.topKeywords(limit),
          this.repo.searchTags(null, null, limit),
          this.repo.searchGenres(null, null, limit),
          this.repo.popularWriters(limit),
        ]);
        return {
          keywords: keywords.map(toTrendingKeyword),
          tags: tags.slice(0, limit).map(toSearchTag),
          genres: genres.slice(0, limit).map(toSearchGenre),
          writers: writers.map(toTrendingWriter),
        };
      }),
    );
  }

  // ── Recent searches (authenticated) ────────────────────────────────────────

  async listRecent(userId: string): Promise<RecentSearchDto[]> {
    const rows = await this.history.listRecent(userId);
    return rows.map(toRecentSearch);
  }

  async deleteRecent(userId: string, id: string): Promise<void> {
    const removed = await this.history.deleteRecent(userId, id);
    if (!removed) {
      throw new SearchRecentNotFoundException();
    }
  }

  async clearRecent(userId: string): Promise<void> {
    await this.history.clearRecent(userId);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Normalizes + enforces the minimum length (docs 05 §3.2). */
  private requireQuery(raw: string): string {
    const q = normalizeSearchQuery(raw);
    if (q.length < SEARCH_QUERY_MIN) {
      throw new SearchQueryTooShortException();
    }
    return q;
  }

  /**
   * For browse-or-search endpoints: absent/whitespace → null (browse all);
   * present but below the minimum → `SEARCH_QUERY_TOO_SHORT`; otherwise the
   * normalized term.
   */
  private optionalQuery(raw: string | undefined): string | null {
    if (raw === undefined) {
      return null;
    }
    const q = normalizeSearchQuery(raw);
    if (q.length === 0) {
      return null;
    }
    if (q.length < SEARCH_QUERY_MIN) {
      throw new SearchQueryTooShortException();
    }
    return q;
  }

  /** Resolves filter codes/slugs to ids (reusing TaxonomyService, docs 16 §3.1). */
  private async resolvePieceFilters(query: SearchPiecesQueryDto): Promise<ResolvedPieceFilters> {
    const languageIds =
      query.language !== undefined
        ? await Promise.all(
            splitCsv(query.language).map((c) => this.taxonomy.resolveLanguageCode(c)),
          )
        : undefined;
    const genreIds =
      query.genre !== undefined
        ? await this.taxonomy.resolveGenreSlugs(splitCsv(query.genre))
        : undefined;

    return {
      languageIds,
      genreIds,
      tagSlug: query.tag?.trim().toLowerCase(),
      author: query.author?.trim().toLowerCase(),
      visibility: query.visibility,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      minReadingTime: query.minReadingTime,
      maxReadingTime: query.maxReadingTime,
    };
  }

  /**
   * Records search analytics — best-effort so a history/keyword write never
   * fails or slows a search. Keyword popularity is tracked for everyone
   * (anonymous included); recent history only for signed-in users.
   */
  private async record(viewer: Viewer, q: string, type: SearchType): Promise<void> {
    try {
      await this.history.recordKeyword(q);
      if (viewer !== null) {
        await this.history.upsertRecent(viewer.id, q, type);
      }
    } catch (error) {
      this.logger.warn(`search analytics write failed: ${(error as Error).message}`);
    }
  }

  /**
   * Runs an FTS read, translating an unexpected backend failure into
   * `SEARCH_UNAVAILABLE` (503, retryable) while letting domain exceptions
   * (invalid filter/cursor/short query) pass through unchanged (docs 05 §3.2).
   */
  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }
      this.logger.error(
        `search backend error: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new SearchUnavailableException();
    }
  }
}
