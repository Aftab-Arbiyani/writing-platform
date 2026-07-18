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
import { PERMISSIONS } from '@qalam/shared';

import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../../permissions/permissions.decorator';
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
 * Semantic Search + saved searches (AF4). Requires `ai.use`; gated by the SemanticSearch
 * feature inside the service. Search runs the reusable Retrieval Platform and returns
 * ranked, grounded, explainable results (optionally a grounded LLM answer). Recent searches
 * reuse the existing `/search/recent` (E8); this owns only the saved-search surface.
 */
@ApiTags('ai-search')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(RateLimitGuard)
export class SemanticSearchController {
  constructor(
    private readonly search: SemanticSearchService,
    private readonly saved: SavedSearchService,
  ) {}

  @Post('search')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('search')
  @ApiOperation({
    summary:
      'Semantic/hybrid search over a story graph or the library. Returns ranked, grounded, ' +
      'explainable results; set `synthesize` for a grounded natural-language answer. Errors: ' +
      'AI_DISABLED, AI_FEATURE_DISABLED, STORY_NOT_FOUND, RETRIEVAL_FAILED.',
  })
  @ApiOkResponse({ type: SemanticSearchResponseDto })
  search_(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SemanticSearchDto,
  ): Promise<SemanticSearchResponseDto> {
    return this.search.search(user.id, dto);
  }

  @Get('search/suggestions')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('search')
  @ApiOperation({ summary: 'Query suggestions (top matching titles) for a short prefix.' })
  @ApiOkResponse({ type: SearchSuggestionsResponseDto })
  async suggestions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchSuggestionsQueryDto,
  ): Promise<SearchSuggestionsResponseDto> {
    return { suggestions: await this.search.suggestions(user.id, query.q, query.storyId) };
  }

  @Get('search/saved')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('read')
  @ApiOperation({ summary: "The caller's saved searches, newest first." })
  @ApiOkResponse({ type: [SavedSearchDto] })
  listSaved(@CurrentUser() user: AuthenticatedUser): Promise<SavedSearchDto[]> {
    return this.saved.list(user.id);
  }

  @Post('search/saved')
  @Permissions(PERMISSIONS.AiUse)
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
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a saved search. Errors: SAVED_SEARCH_NOT_FOUND.' })
  removeSaved(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.saved.remove(user.id, id);
  }
}
