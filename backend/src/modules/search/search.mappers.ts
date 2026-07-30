import { SearchSort } from '@qalam/shared';
import type { TextDirection, Visibility } from '@qalam/shared';

import type { CursorPayload } from '../../common/pagination/cursor.util';
import type {
  GenreSuggestionDto,
  PieceSuggestionDto,
  TagSuggestionDto,
  WriterSuggestionDto,
} from './dto/autocomplete-result.dto';
import type { RecentSearchDto } from './dto/recent-search.dto';
import type {
  SearchGenreDto,
  SearchLanguageDto,
  SearchPieceDto,
  SearchTagDto,
  SearchWriterDto,
} from './dto/search-result.dto';
import type { TrendingKeywordDto, TrendingWriterDto } from './dto/trending.dto';
import type { RecentSearch } from './entities/recent-search.entity';
import type { SearchKeyword } from './entities/search-keyword.entity';
import type {
  GenreSuggestionRow,
  PieceSuggestionRow,
  PopularWriterRow,
  SearchGenreRow,
  SearchLanguageRow,
  SearchPieceRow,
  SearchTagRow,
  SearchWriterRow,
  TagSuggestionRow,
  WriterSuggestionRow,
} from './search.repository';

/** Postgres may hand raw aggregates back as strings — coerce defensively. */
function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}
function isoOrNull(value: Date | string | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

// ── Result rows → DTOs ──────────────────────────────────────────────────────

export function toSearchPiece(row: SearchPieceRow): SearchPieceDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    featuredQuote: row.featuredQuote,
    coverImageKey: row.coverImageKey,
    language: {
      code: row.langCode,
      direction: row.langDirection as TextDirection,
      nativeName: row.langNativeName,
    },
    genre: row.genreSlug !== null ? { slug: row.genreSlug, name: row.genreName ?? '' } : null,
    author: { username: row.username, penName: row.penName, avatarKey: row.avatarKey },
    stats: {
      likes: num(row.likesCount),
      claps: num(row.clapsCount),
      comments: num(row.commentsCount),
      responses: num(row.responsesCount),
    },
    visibility: row.visibility as Visibility,
    wordCount: num(row.wordCount),
    readingTimeSeconds: num(row.readingTimeSeconds),
    publishedAt: isoOrNull(row.publishedAt),
    rank: num(row.relevance),
  };
}

export function toSearchWriter(row: SearchWriterRow): SearchWriterDto {
  return {
    userId: row.userId,
    username: row.username,
    penName: row.penName,
    // Private accounts are findable but return a teaser — never their bio (docs 13 §4.2).
    bio: row.isPrivate ? null : row.bio,
    avatarKey: row.avatarKey,
    isPrivate: row.isPrivate,
    followersCount: num(row.followersCount),
    piecesCount: num(row.piecesCount),
    rank: num(row.relevance),
  };
}

export function toSearchTag(row: SearchTagRow): SearchTagDto {
  return { slug: row.slug, name: row.name, pieceCount: num(row.pieceCount) };
}

export function toSearchGenre(row: SearchGenreRow): SearchGenreDto {
  return { slug: row.slug, name: row.name, pieceCount: num(row.pieceCount) };
}

export function toSearchLanguage(row: SearchLanguageRow): SearchLanguageDto {
  return {
    code: row.code,
    nativeName: row.nativeName,
    direction: row.direction as TextDirection,
    pieceCount: num(row.pieceCount),
  };
}

// ── Autocomplete rows → DTOs ────────────────────────────────────────────────

export function toWriterSuggestion(row: WriterSuggestionRow): WriterSuggestionDto {
  return { username: row.username, penName: row.penName, avatarKey: row.avatarKey };
}
export function toTagSuggestion(row: TagSuggestionRow): TagSuggestionDto {
  return { slug: row.slug, name: row.name };
}
export function toGenreSuggestion(row: GenreSuggestionRow): GenreSuggestionDto {
  return { slug: row.slug, name: row.name };
}
export function toPieceSuggestion(row: PieceSuggestionRow): PieceSuggestionDto {
  return { slug: row.slug, title: row.title };
}

// ── Trending rows → DTOs ────────────────────────────────────────────────────

export function toTrendingKeyword(row: SearchKeyword): TrendingKeywordDto {
  return { keyword: row.keyword, searchCount: num(row.searchCount) };
}
export function toTrendingWriter(row: PopularWriterRow): TrendingWriterDto {
  return {
    username: row.username,
    penName: row.penName,
    avatarKey: row.avatarKey,
    followersCount: num(row.followersCount),
  };
}

// ── Recent search → DTO ─────────────────────────────────────────────────────

export function toRecentSearch(row: RecentSearch): RecentSearchDto {
  return {
    id: row.id,
    query: row.query,
    searchType: row.searchType,
    searchedAt: new Date(row.updatedAt).toISOString(),
  };
}

// ── Cursor keys (must match the repository's ORDER BY / keyset) ──────────────

export function pieceCursorKey(row: SearchPieceRow, sort: SearchSort): CursorPayload {
  const k =
    sort === SearchSort.Latest
      ? (isoOrNull(row.publishedAt) ?? '')
      : sort === SearchSort.MostClapped
        ? String(num(row.clapsCount))
        : sort === SearchSort.MostCommented
          ? String(num(row.commentsCount))
          : sort === SearchSort.Trending
            ? String(num(row.trendingScore))
            : String(num(row.relevance));
  return { k, id: row.id };
}

export function writerCursorKey(row: SearchWriterRow): CursorPayload {
  return { k: String(num(row.relevance)), id: row.userId };
}

export function tagCursorKey(row: SearchTagRow): CursorPayload {
  return { k: String(num(row.pieceCount)), id: row.id };
}
export function genreCursorKey(row: SearchGenreRow): CursorPayload {
  return { k: String(num(row.pieceCount)), id: row.id };
}
export function languageCursorKey(row: SearchLanguageRow): CursorPayload {
  return { k: String(num(row.pieceCount)), id: row.id };
}
