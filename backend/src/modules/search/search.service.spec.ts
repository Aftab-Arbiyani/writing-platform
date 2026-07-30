import { SearchSort, SearchType } from '@qalam/shared';

import type { TaxonomyService } from '../taxonomy/taxonomy.service';
import type { AutocompleteQueryDto } from './dto/autocomplete-query.dto';
import type { SearchPiecesQueryDto } from './dto/search-pieces-query.dto';
import type { SearchQueryDto } from './dto/search-query.dto';
import type { SearchTaxonomyQueryDto } from './dto/search-taxonomy-query.dto';
import type { SearchWritersQueryDto } from './dto/search-writers-query.dto';
import type { TrendingQueryDto } from './dto/trending-query.dto';
import {
  SearchQueryTooShortException,
  SearchRecentNotFoundException,
  SearchUnavailableException,
} from './search.exceptions';
import type { SearchCacheService } from './search-cache.service';
import type { SearchHistoryRepository } from './search-history.repository';
import type { SearchPieceRow, SearchRepository, SearchWriterRow } from './search.repository';
import { SearchService } from './search.service';

function pieceRow(overrides: Partial<SearchPieceRow> = {}): SearchPieceRow {
  return {
    id: 'p1',
    slug: 'raat-ki-baarish',
    title: 'رات کی بارش',
    subtitle: null,
    featuredQuote: null,
    coverImageKey: null,
    visibility: 'public',
    wordCount: 120,
    readingTimeSeconds: 60,
    publishedAt: new Date('2026-07-01T00:00:00.000Z'),
    langCode: 'ur',
    langDirection: 'rtl',
    langNativeName: 'اردو',
    genreSlug: 'ghazal',
    genreName: 'Ghazal',
    username: 'meera_k',
    penName: 'Meera',
    avatarKey: null,
    likesCount: 2,
    clapsCount: 40,
    commentsCount: 3,
    responsesCount: 1,
    trendingScore: 9.5,
    relevance: 0.83,
    ...overrides,
  };
}

function writerRow(overrides: Partial<SearchWriterRow> = {}): SearchWriterRow {
  return {
    userId: 'u1',
    username: 'meera_k',
    penName: 'Meera',
    avatarKey: null,
    bio: 'Poet of the rains.',
    isPrivate: false,
    followersCount: 10,
    piecesCount: 4,
    relevance: 0.7,
    ...overrides,
  };
}

function build() {
  const repo = {
    searchPieces: jest.fn().mockResolvedValue([pieceRow()]),
    searchWriters: jest.fn().mockResolvedValue([writerRow()]),
    searchTags: jest
      .fn()
      .mockResolvedValue([{ id: 't1', slug: 'barish', name: 'بارش', pieceCount: 5 }]),
    searchGenres: jest
      .fn()
      .mockResolvedValue([{ id: 'g1', slug: 'ghazal', name: 'Ghazal', pieceCount: 7 }]),
    searchLanguages: jest
      .fn()
      .mockResolvedValue([
        { id: 'l1', code: 'ur', nativeName: 'اردو', direction: 'rtl', pieceCount: 9 },
      ]),
    autocompleteWriters: jest
      .fn()
      .mockResolvedValue([{ username: 'meera_k', penName: 'Meera', avatarKey: null }]),
    autocompleteTags: jest.fn().mockResolvedValue([{ slug: 'barish', name: 'بارش' }]),
    autocompleteGenres: jest.fn().mockResolvedValue([{ slug: 'ghazal', name: 'Ghazal' }]),
    autocompletePieces: jest
      .fn()
      .mockResolvedValue([{ slug: 'raat-ki-baarish', title: 'رات کی بارش' }]),
    popularWriters: jest
      .fn()
      .mockResolvedValue([
        { username: 'meera_k', penName: 'Meera', avatarKey: null, followersCount: 10 },
      ]),
  };
  const history = {
    recordKeyword: jest.fn().mockResolvedValue(undefined),
    upsertRecent: jest.fn().mockResolvedValue(undefined),
    listRecent: jest.fn().mockResolvedValue([]),
    deleteRecent: jest.fn().mockResolvedValue(true),
    clearRecent: jest.fn().mockResolvedValue(undefined),
    topKeywords: jest.fn().mockResolvedValue([{ keyword: 'barish', searchCount: 42 }]),
  };
  const cache = {
    remember: jest.fn((_key: string, _ttl: number, compute: () => Promise<unknown>) => compute()),
  };
  const taxonomy = {
    resolveLanguageCode: jest.fn().mockResolvedValue('lang-ur'),
    resolveGenreSlugs: jest.fn().mockResolvedValue(['genre-ghazal']),
  };
  const service = new SearchService(
    repo as unknown as SearchRepository,
    history as unknown as SearchHistoryRepository,
    cache as unknown as SearchCacheService,
    taxonomy as unknown as TaxonomyService,
  );
  return { service, repo, history, cache, taxonomy };
}

const piecesQuery = (o: Partial<SearchPiecesQueryDto> = {}): SearchPiecesQueryDto =>
  ({ q: 'barish', limit: 20, sort: SearchSort.Relevance, ...o }) as SearchPiecesQueryDto;

describe('SearchService', () => {
  describe('query validation', () => {
    it('throws SEARCH_QUERY_TOO_SHORT for a query under the minimum', async () => {
      const { service } = build();
      await expect(service.searchPieces(piecesQuery({ q: 'a' }), null)).rejects.toBeInstanceOf(
        SearchQueryTooShortException,
      );
    });

    it('throws SEARCH_QUERY_TOO_SHORT when the query normalizes to whitespace', async () => {
      const { service } = build();
      await expect(service.searchPieces(piecesQuery({ q: '   ' }), null)).rejects.toBeInstanceOf(
        SearchQueryTooShortException,
      );
    });
  });

  describe('searchPieces', () => {
    it('maps rows to DTOs and passes a normalized (lowercased) query to the repo', async () => {
      const { service, repo } = build();
      const page = await service.searchPieces(piecesQuery({ q: '  Barish ' }), null);
      expect(repo.searchPieces).toHaveBeenCalledWith(
        'barish',
        expect.any(Object),
        SearchSort.Relevance,
        null,
        20,
      );
      const first = page.items[0];
      expect(first).toMatchObject({ id: 'p1', slug: 'raat-ki-baarish', rank: 0.83 });
      expect(first?.publishedAt).toBe('2026-07-01T00:00:00.000Z');
    });

    it('resolves language/genre filters through TaxonomyService', async () => {
      const { service, repo, taxonomy } = build();
      await service.searchPieces(piecesQuery({ language: 'ur', genre: 'ghazal' }), null);
      expect(taxonomy.resolveLanguageCode).toHaveBeenCalledWith('ur');
      expect(taxonomy.resolveGenreSlugs).toHaveBeenCalledWith(['ghazal']);
      const filters = repo.searchPieces.mock.calls[0]?.[1] as {
        languageIds?: string[];
        genreIds?: string[];
      };
      expect(filters.languageIds).toEqual(['lang-ur']);
      expect(filters.genreIds).toEqual(['genre-ghazal']);
    });

    it('records the keyword and the recent search for a signed-in viewer', async () => {
      const { service, history } = build();
      await service.searchPieces(piecesQuery(), { id: 'viewer-1' });
      expect(history.recordKeyword).toHaveBeenCalledWith('barish');
      expect(history.upsertRecent).toHaveBeenCalledWith('viewer-1', 'barish', SearchType.Pieces);
    });

    it('records the keyword but no recent search for an anonymous viewer', async () => {
      const { service, history } = build();
      await service.searchPieces(piecesQuery(), null);
      expect(history.recordKeyword).toHaveBeenCalledWith('barish');
      expect(history.upsertRecent).not.toHaveBeenCalled();
    });

    it('never fails the search when analytics writes error (best-effort)', async () => {
      const { service, history } = build();
      history.recordKeyword.mockRejectedValueOnce(new Error('redis down'));
      await expect(service.searchPieces(piecesQuery(), { id: 'v' })).resolves.toBeDefined();
    });

    it('translates an unexpected backend error into SEARCH_UNAVAILABLE (503)', async () => {
      const { service, repo } = build();
      repo.searchPieces.mockRejectedValueOnce(new Error('connection reset'));
      await expect(service.searchPieces(piecesQuery(), null)).rejects.toBeInstanceOf(
        SearchUnavailableException,
      );
    });
  });

  describe('globalSearch', () => {
    it('runs every group for type=all', async () => {
      const { service, repo } = build();
      const result = await service.globalSearch(
        { q: 'barish', type: SearchType.All, limit: 5 } as SearchQueryDto,
        null,
      );
      expect(repo.searchPieces).toHaveBeenCalled();
      expect(repo.searchWriters).toHaveBeenCalled();
      expect(repo.searchTags).toHaveBeenCalled();
      expect(repo.searchGenres).toHaveBeenCalled();
      expect(repo.searchLanguages).toHaveBeenCalled();
      expect(result.pieces).toHaveLength(1);
      expect(result.writers).toHaveLength(1);
    });

    it('runs only the requested group for a narrowed type', async () => {
      const { service, repo } = build();
      const result = await service.globalSearch(
        { q: 'barish', type: SearchType.Writers, limit: 5 } as SearchQueryDto,
        null,
      );
      expect(repo.searchWriters).toHaveBeenCalled();
      expect(repo.searchPieces).not.toHaveBeenCalled();
      expect(result.pieces).toEqual([]);
      expect(result.writers).toHaveLength(1);
    });
  });

  describe('searchWriters', () => {
    it('nulls the bio for a private account (teaser) but keeps it findable', async () => {
      const { service, repo } = build();
      repo.searchWriters.mockResolvedValueOnce([writerRow({ isPrivate: true, bio: 'secret' })]);
      const page = await service.searchWriters(
        { q: 'meera', limit: 20 } as SearchWritersQueryDto,
        null,
      );
      expect(page.items[0]).toMatchObject({ username: 'meera_k', isPrivate: true, bio: null });
    });

    it('resolves an optional language filter to an id', async () => {
      const { service, repo, taxonomy } = build();
      await service.searchWriters(
        { q: 'meera', language: 'ur', limit: 20 } as SearchWritersQueryDto,
        null,
      );
      expect(taxonomy.resolveLanguageCode).toHaveBeenCalledWith('ur');
      expect(repo.searchWriters).toHaveBeenCalledWith('meera', 'lang-ur', undefined, null, 20);
    });
  });

  describe('taxonomy search (browse when q omitted)', () => {
    it('passes null to the repo when q is absent (browse by popularity)', async () => {
      const { service, repo } = build();
      await service.searchTags({ limit: 20 } as SearchTaxonomyQueryDto);
      expect(repo.searchTags).toHaveBeenCalledWith(null, null, 20);
    });

    it('passes the normalized query when q is present', async () => {
      const { service, repo } = build();
      await service.searchGenres({ q: 'Ghaz', limit: 20 } as SearchTaxonomyQueryDto);
      expect(repo.searchGenres).toHaveBeenCalledWith('ghaz', null, 20);
    });
  });

  describe('autocomplete', () => {
    it('reads through the cache and maps every group', async () => {
      const { service, cache } = build();
      const result = await service.autocomplete({
        q: 'gha',
        type: SearchType.All,
        limit: 10,
      } as AutocompleteQueryDto);
      expect(cache.remember).toHaveBeenCalled();
      expect(result.writers).toHaveLength(1);
      expect(result.tags).toHaveLength(1);
      expect(result.genres).toHaveLength(1);
      expect(result.pieces).toHaveLength(1);
    });
  });

  describe('trending', () => {
    it('assembles keywords, tags, genres, and writers (cached)', async () => {
      const { service, history, repo } = build();
      const result = await service.trending({ limit: 10 } as TrendingQueryDto);
      expect(history.topKeywords).toHaveBeenCalledWith(10);
      expect(repo.popularWriters).toHaveBeenCalledWith(10);
      expect(result.keywords[0]).toEqual({ keyword: 'barish', searchCount: 42 });
      expect(result.writers).toHaveLength(1);
    });
  });

  describe('recent searches', () => {
    it('throws SEARCH_RECENT_NOT_FOUND when deleting a missing row', async () => {
      const { service, history } = build();
      history.deleteRecent.mockResolvedValueOnce(false);
      await expect(service.deleteRecent('u1', 'missing')).rejects.toBeInstanceOf(
        SearchRecentNotFoundException,
      );
    });

    it('clears all recent searches for the user', async () => {
      const { service, history } = build();
      await service.clearRecent('u1');
      expect(history.clearRecent).toHaveBeenCalledWith('u1');
    });
  });
});
