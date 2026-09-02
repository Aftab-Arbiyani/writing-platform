import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { RecommendationQueryDto } from '../dto/retrieval-request.dto';
import { RecommendationResponseDto } from '../dto/retrieval-response.dto';
import { RecommendationService } from './recommendation.service';

/**
 * Recommendation Engine (AF4). Authenticated (the story-scoped kinds read the caller's own
 * graph), but no longer permission- or feature-gated: D5 established that this surface calls
 * no LLM, so `ai.use` and the Recommendations flag were removed. Every recommendation
 * explains itself (reason + influencing entities + evidence + confidence). Reuses
 * trending/discovery/search and the story graph — no parallel stack.
 */
@ApiTags('ai-recommendations')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(RateLimitGuard)
export class RecommendationController {
  constructor(private readonly recommendations: RecommendationService) {}

  @Get('recommendations')
  @RateLimit('read')
  @ApiOperation({
    summary:
      'Explainable recommendations across surfaces (related stories/chapters/characters/' +
      'topics, continue reading, authors, genres, collections, feed, trending). Errors: ' +
      'STORY_NOT_FOUND.',
  })
  @ApiOkResponse({ type: RecommendationResponseDto })
  recommend(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecommendationQueryDto,
  ): Promise<RecommendationResponseDto> {
    return this.recommendations.recommend(user.id, query);
  }
}
