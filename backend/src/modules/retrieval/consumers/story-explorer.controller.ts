import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';

import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../../permissions/permissions.decorator';
import { ExplorerViewResponseDto } from '../dto/retrieval-response.dto';
import { StoryExplorerService } from './story-explorer.service';

/**
 * Story Explorer (AF4). Structured views over the AF3 knowledge graph — characters,
 * relationships, timeline, locations, events, objects, concepts, and the full map. Requires
 * `ai.use`; owner-scoped (a foreign/missing story is STORY_NOT_FOUND). No LLM: every view
 * renders directly from graph node/edge objects.
 */
@ApiTags('ai-explorer')
@ApiBearerAuth()
@Controller('ai/explorer')
@UseGuards(RateLimitGuard)
export class StoryExplorerController {
  constructor(private readonly explorer: StoryExplorerService) {}

  @Get(':storyId/:view')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('read')
  @ApiOperation({
    summary:
      'A structured explorer view over the story graph (view = characters|relationships|' +
      'timeline|locations|events|objects|concepts|map). Errors: STORY_NOT_FOUND.',
  })
  @ApiOkResponse({ type: ExplorerViewResponseDto })
  explore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId') storyId: string,
    @Param('view') view: string,
  ): Promise<ExplorerViewResponseDto> {
    return this.explorer.explore(user.id, storyId, view);
  }
}
