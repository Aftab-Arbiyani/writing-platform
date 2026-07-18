import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
import { PERMISSIONS } from '@qalam/shared';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';
import { AnalyzeStoryDto, StoryAnalysesQueryDto } from './dto/story-request.dto';
import {
  StoryAnalysisResultDto,
  StoryAnalysisSummaryDto,
  StoryCharacterGraphDto,
  StoryGraphDto,
  StoryTimelineDto,
} from './dto/story-response.dto';
import {
  toAnalysisResultDto,
  toAnalysisSummaryDto,
  toCharacterGraphDto,
  toGraphDto,
  toTimelineDto,
} from './story.mappers';
import { StoryIntelligenceService } from './story-intelligence.service';

/**
 * Story Intelligence (AF3) — structured analysis + the story knowledge graph. Requires
 * `ai.use`; every read is owner-scoped by the service (a foreign/missing story reads as
 * STORY_NOT_FOUND). `:storyId` is the caller's opaque story key (a piece id or a local
 * draft id) — the module never touches the pieces tables. Analysis runs through the AF1
 * orchestrator and returns STRUCTURED objects; the graph is the single source of truth.
 */
@ApiTags('story-intelligence')
@ApiBearerAuth()
@Controller('story-intelligence')
@UseGuards(RateLimitGuard)
export class StoryIntelligenceController {
  constructor(private readonly service: StoryIntelligenceService) {}

  @Post(':storyId/analyze')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('aiCompletion')
  @ApiOperation({
    summary:
      'Run a structured analysis (character/plot/world/style/timeline) and fold it into ' +
      'the story graph. Errors: AI_DISABLED, AI_FEATURE_DISABLED, AI_USAGE_LIMIT_EXCEEDED, ' +
      'AI_CONTEXT_TOO_LARGE, STORY_CONTENT_EMPTY.',
  })
  @ApiOkResponse({ type: StoryAnalysisResultDto })
  async analyze(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId') storyId: string,
    @Body() dto: AnalyzeStoryDto,
  ): Promise<StoryAnalysisResultDto> {
    const run = await this.service.analyze(user.id, storyId, {
      kind: dto.kind,
      scope: dto.scope,
      content: dto.content,
      chapterRef: dto.chapterRef,
      storyTitle: dto.storyTitle,
    });
    return toAnalysisResultDto(run, storyId);
  }

  @Get(':storyId/graph')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'The full story knowledge graph (nodes + edges).' })
  @ApiOkResponse({ type: StoryGraphDto })
  async getGraph(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId') storyId: string,
  ): Promise<StoryGraphDto> {
    return toGraphDto(await this.service.getGraph(user.id, storyId));
  }

  @Get(':storyId/graph/characters')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'Character nodes + the relationships among them.' })
  @ApiOkResponse({ type: StoryCharacterGraphDto })
  async getCharacters(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId') storyId: string,
  ): Promise<StoryCharacterGraphDto> {
    return toCharacterGraphDto(await this.service.getCharacterGraph(user.id, storyId));
  }

  @Get(':storyId/timeline')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'Event nodes ordered chronologically (the timeline view).' })
  @ApiOkResponse({ type: StoryTimelineDto })
  async getTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId') storyId: string,
  ): Promise<StoryTimelineDto> {
    const { graph, events } = await this.service.getTimeline(user.id, storyId);
    return toTimelineDto(graph, events);
  }

  @Get(':storyId/analyses')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'Analysis-run history, newest first (cursor-paginated).' })
  @ApiOkResponse({ type: [StoryAnalysisSummaryDto] })
  async listAnalyses(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId') storyId: string,
    @Query() query: StoryAnalysesQueryDto,
  ) {
    const page = await this.service.listAnalyses(user.id, storyId, query.cursor, query.limit);
    return {
      success: true as const,
      data: page.items.map(toAnalysisSummaryDto),
      meta: { pagination: page.meta },
    };
  }

  @Get(':storyId/analyses/:analysisId')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'One analysis run with its full structured payload.' })
  @ApiOkResponse({ type: StoryAnalysisResultDto })
  async getAnalysis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId') storyId: string,
    @Param('analysisId', ParseUUIDPipe) analysisId: string,
  ): Promise<StoryAnalysisResultDto> {
    const run = await this.service.getAnalysis(user.id, storyId, analysisId);
    return toAnalysisResultDto(run, storyId);
  }

  @Delete(':storyId/graph')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset (delete) the story graph and all its analyses.' })
  @ApiNoContentResponse()
  async reset(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId') storyId: string,
  ): Promise<void> {
    await this.service.resetGraph(user.id, storyId);
  }
}
