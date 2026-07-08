import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AutocompleteQueryDto } from './dto/autocomplete-query.dto';
import { AutocompleteResultDto } from './dto/autocomplete-result.dto';
import { RecentSearchDto } from './dto/recent-search.dto';
import { SearchPiecesQueryDto } from './dto/search-pieces-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import {
  GlobalSearchResultDto,
  SearchGenreDto,
  SearchLanguageDto,
  SearchPieceDto,
  SearchTagDto,
  SearchWriterDto,
} from './dto/search-result.dto';
import { SearchTaxonomyQueryDto } from './dto/search-taxonomy-query.dto';
import { SearchWritersQueryDto } from './dto/search-writers-query.dto';
import { TrendingQueryDto } from './dto/trending-query.dto';
import { TrendingSearchesDto } from './dto/trending.dto';
import { SearchService } from './search.service';

/**
 * Search & Discovery (E8). Query endpoints are `@Public()` (browse without an
 * account) but attach the viewer when present (`OptionalAuthGuard`) so a signed-in
 * user's searches land in their recent history. Recent-search management requires
 * auth (global `JwtAuthGuard`). All FTS reads carry the `search` rate-limit tier
 * (the most expensive read, docs 05 §8); trending/recent use the lighter `read`
 * tier. Thin controller — logic lives in `SearchService` (docs 16 §3.6).
 */
@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  private viewer(user: AuthenticatedUser | undefined): { id: string } | null {
    return user !== undefined ? { id: user.id } : null;
  }

  // ── Global grouped search ──────────────────────────────────────────────────

  @Get()
  @Public()
  @UseGuards(OptionalAuthGuard, RateLimitGuard)
  @RateLimit('search')
  @ApiOperation({
    summary: 'Grouped global search across writers, pieces, tags, genres, languages.',
    description:
      'Returns a small relevance-ranked preview per group. Use the per-type endpoints for ' +
      'deep pagination. Errors: SEARCH_QUERY_TOO_SHORT (400), SEARCH_UNAVAILABLE (503).',
  })
  @ApiOkResponse({ type: GlobalSearchResultDto })
  globalSearch(
    @Query() query: SearchQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<GlobalSearchResultDto> {
    return this.search.globalSearch(query, this.viewer(user));
  }

  // ── Piece search ───────────────────────────────────────────────────────────

  @Get('pieces')
  @Public()
  @UseGuards(OptionalAuthGuard, RateLimitGuard)
  @RateLimit('search')
  @ApiOperation({
    summary: 'Full-text piece search — filters, ranking, cursor pagination.',
    description:
      'Matches title/subtitle/content (FTS), featured quote, tags and slug. Only published, ' +
      'public pieces from non-private authors. Sort: relevance (default) | latest | trending | ' +
      'most_clapped | most_commented. Errors: SEARCH_QUERY_TOO_SHORT (400), FEED_INVALID_CURSOR ' +
      '(400), LANGUAGE_INVALID/GENRE_INVALID (422), SEARCH_UNAVAILABLE (503).',
  })
  @ApiOkResponse({ type: [SearchPieceDto] })
  async searchPieces(
    @Query() query: SearchPiecesQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const page = await this.search.searchPieces(query, this.viewer(user));
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  // ── Writer search ──────────────────────────────────────────────────────────

  @Get('writers')
  @Public()
  @UseGuards(OptionalAuthGuard, RateLimitGuard)
  @RateLimit('search')
  @ApiOperation({
    summary: 'Writer search over username, pen name, and bio — cursor-paginated.',
    description:
      'Private accounts are findable (name only) and returned as a teaser (no bio). Optional ' +
      'language/genre filters. Errors: SEARCH_QUERY_TOO_SHORT (400), FEED_INVALID_CURSOR (400), ' +
      'LANGUAGE_INVALID (422), SEARCH_UNAVAILABLE (503).',
  })
  @ApiOkResponse({ type: [SearchWriterDto] })
  async searchWriters(
    @Query() query: SearchWritersQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const page = await this.search.searchWriters(query, this.viewer(user));
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  // ── Tag / Genre / Language search ──────────────────────────────────────────

  @Get('tags')
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit('search')
  @ApiOperation({
    summary: 'Tag search (prefix + fuzzy); omit q to browse by usage. Cursor-paginated.',
    description: 'Each result carries its piece count. Errors: SEARCH_UNAVAILABLE (503).',
  })
  @ApiOkResponse({ type: [SearchTagDto] })
  async searchTags(@Query() query: SearchTaxonomyQueryDto) {
    const page = await this.search.searchTags(query);
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  @Get('genres')
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit('search')
  @ApiOperation({
    summary: 'Genre search; omit q to browse by public-piece count. Cursor-paginated.',
  })
  @ApiOkResponse({ type: [SearchGenreDto] })
  async searchGenres(@Query() query: SearchTaxonomyQueryDto) {
    const page = await this.search.searchGenres(query);
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  @Get('languages')
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit('search')
  @ApiOperation({
    summary: 'Language search; omit q to browse by public-piece count. Cursor-paginated.',
  })
  @ApiOkResponse({ type: [SearchLanguageDto] })
  async searchLanguages(@Query() query: SearchTaxonomyQueryDto) {
    const page = await this.search.searchLanguages(query);
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  // ── Autocomplete (cached) ──────────────────────────────────────────────────

  @Get('autocomplete')
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit('search')
  @ApiOperation({
    summary: 'Prefix-first suggestions for writers, tags, genres, and piece titles (≤ 10 each).',
    description: 'Cached briefly. Errors: SEARCH_QUERY_TOO_SHORT (400), SEARCH_UNAVAILABLE (503).',
  })
  @ApiOkResponse({ type: AutocompleteResultDto })
  autocomplete(@Query() query: AutocompleteQueryDto): Promise<AutocompleteResultDto> {
    return this.search.autocomplete(query);
  }

  // ── Trending (cached) ──────────────────────────────────────────────────────

  @Get('trending')
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit('read')
  @ApiOperation({
    summary: 'Popular keywords, tags, genres, and writers. Cached snapshot.',
  })
  @ApiOkResponse({ type: TrendingSearchesDto })
  trending(@Query() query: TrendingQueryDto): Promise<TrendingSearchesDto> {
    return this.search.trending(query);
  }

  // ── Recent searches (authenticated) ────────────────────────────────────────

  @Get('recent')
  @UseGuards(RateLimitGuard)
  @RateLimit('read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Your recent searches, newest first (max 20).' })
  @ApiOkResponse({ type: [RecentSearchDto] })
  listRecent(@CurrentUser() user: AuthenticatedUser): Promise<RecentSearchDto[]> {
    return this.search.listRecent(user.id);
  }

  @Delete('recent/:id')
  @UseGuards(RateLimitGuard)
  @RateLimit('read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete one recent search. Errors: SEARCH_RECENT_NOT_FOUND (404).' })
  @ApiNoContentResponse()
  deleteRecent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.search.deleteRecent(user.id, id);
  }

  @Delete('recent')
  @UseGuards(RateLimitGuard)
  @RateLimit('read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clear all your recent searches.' })
  @ApiNoContentResponse()
  clearRecent(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.search.clearRecent(user.id);
  }
}
