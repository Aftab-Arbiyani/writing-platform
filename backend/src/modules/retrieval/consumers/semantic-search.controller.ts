import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { OptionalAuthGuard } from '../../auth/guards/optional-auth.guard';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  SaveSearchDto,
  SearchSuggestionsQueryDto,
  SemanticSearchDto,
} from '../dto/retrieval-request.dto';
import {
  SavedSearchDto,
  SearchSuggestionsResponseDto,
  SemanticSearchResponseDto,
} from '../dto/retrieval-response.dto';
import { SavedSearchService } from './saved-search.service';
import { SemanticSearchService } from './semantic-search.service';

/**
 * Search + saved searches (AF4 retrieval engine). The query endpoints are `@Public()`
 * (browse without an account) but attach the viewer when present (`OptionalAuthGuard`),
 * exactly like E8's `/search` — the knowledge-graph source is owner-scoped and simply
 * contributes nothing for an anonymous caller. Search runs the reusable Retrieval
 * Platform and returns ranked, grounded, explainable results; no LLM is involved (D5).
 * Recent searches reuse the existing `/search/recent` (E8); this owns only the
 * saved-search surface, which stays authenticated.
 */
@ApiTags('ai-search')
@Controller('ai')
export class SemanticSearchController {
  constructor(
    private readonly search: SemanticSearchService,
    private readonly saved: SavedSearchService,
  ) {}

  @Post('search')
  @Public()
  @UseGuards(OptionalAuthGuard, RateLimitGuard)
  @RateLimit('search')
  @ApiOperation({
    summary:
      'Hybrid search over a story graph or the library. Returns ranked, grounded, ' +
      'explainable results. Story-scoped search requires a signed-in owner. Errors: ' +
      'RETRIEVAL_QUERY_INVALID, STORY_NOT_FOUND, RETRIEVAL_FAILED.',
  })
  @ApiOkResponse({ type: SemanticSearchResponseDto })
  search_(
    @Body() dto: SemanticSearchDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<SemanticSearchResponseDto> {
    return this.search.search(user?.id ?? null, dto);
  }

  @Get('search/suggestions')
  @Public()
  @UseGuards(OptionalAuthGuard, RateLimitGuard)
  @RateLimit('search')
  @ApiOperation({ summary: 'Query suggestions (top matching titles) for a short prefix.' })
  @ApiOkResponse({ type: SearchSuggestionsResponseDto })
  async suggestions(
    @Query() query: SearchSuggestionsQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<SearchSuggestionsResponseDto> {
    return {
      suggestions: await this.search.suggestions(user?.id ?? null, query.q, query.storyId),
    };
  }

  @Get('search/saved')
  @ApiBearerAuth()
  @UseGuards(RateLimitGuard)
  @RateLimit('read')
  @ApiOperation({ summary: "The caller's saved searches, newest first." })
  @ApiOkResponse({ type: [SavedSearchDto] })
  listSaved(@CurrentUser() user: AuthenticatedUser): Promise<SavedSearchDto[]> {
    return this.saved.list(user.id);
  }

  @Post('search/saved')
  @ApiBearerAuth()
  @UseGuards(RateLimitGuard)
  @RateLimit('write')
  @ApiOperation({
    summary: 'Save a search (idempotent by name). Errors: SAVED_SEARCH_LIMIT_EXCEEDED.',
  })
  @ApiOkResponse({ type: SavedSearchDto })
  saveSearch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveSearchDto,
  ): Promise<SavedSearchDto> {
    return this.saved.save(user.id, dto);
  }

  @Delete('search/saved/:id')
  @ApiBearerAuth()
  @UseGuards(RateLimitGuard)
  @RateLimit('write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a saved search. Errors: SAVED_SEARCH_NOT_FOUND.' })
  removeSaved(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.saved.remove(user.id, id);
  }
}
