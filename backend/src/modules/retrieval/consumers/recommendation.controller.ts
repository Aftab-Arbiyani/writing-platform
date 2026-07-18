import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';

import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../../permissions/permissions.decorator';
import { RecommendationQueryDto } from '../dto/retrieval-request.dto';
import { RecommendationResponseDto } from '../dto/retrieval-response.dto';
import { RecommendationService } from './recommendation.service';

/**
 * Recommendation Engine (AF4). Requires `ai.use`; gated by the Recommendations feature.
 * Every recommendation explains itself (reason + influencing entities + evidence +
 * confidence). Reuses trending/discovery/search and the story graph — no parallel stack.
 */
@ApiTags('ai-recommendations')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(RateLimitGuard)
export class RecommendationController {
  constructor(private readonly recommendations: RecommendationService) {}

  @Get('recommendations')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('read')
  @ApiOperation({
    summary:
      'Explainable recommendations across surfaces (related stories/chapters/characters/' +
      'topics, continue reading, authors, genres, collections, feed, trending). Errors: ' +
      'AI_DISABLED, AI_FEATURE_DISABLED, STORY_NOT_FOUND.',
  })
  @ApiOkResponse({ type: RecommendationResponseDto })
  recommend(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecommendationQueryDto,
  ): Promise<RecommendationResponseDto> {
    return this.recommendations.recommend(user.id, query);
  }
}
