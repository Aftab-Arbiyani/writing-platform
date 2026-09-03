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
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';
import type { Request, Response } from 'express';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';
import { AppException } from '../../common/exceptions/app.exception';
import { initSse, sendSse } from '../ai/streaming/sse.util';
import { AnalyzeStoryDto, MapStoryDto, StoryAnalysesQueryDto } from './dto/story-request.dto';
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

  /**
   * Build the story's whole map — every analysis, folded into one graph.
   *
   * SSE rather than a buffered POST because five sequential model calls take long enough to
   * sit behind a proxy timeout, and because a writer watching a five-step job wants to see it
   * move. The client renders `progress` as a step counter and `done` as a refresh.
   *
   * An `error` event carries a real domain code — most usefully QUOTA_EXCEEDED, which the
   * service raises BEFORE the first call by reserving the whole run, so a writer without
   * enough allowance is told so instead of getting a half-built graph.
   */
  @Post(':storyId/map/stream')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('aiCompletion')
  @ApiProduces('text/event-stream')
  @ApiOperation({
    summary:
      'Map a whole story: run every analysis and fold each into its graph (SSE: progress* ' +
      '→ done | error). Errors: ENTITLEMENT_DENIED, QUOTA_EXCEEDED, AI_DISABLED, ' +
      'STORY_CONTENT_EMPTY.',
  })
  async mapStory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Body() dto: MapStoryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    let closed = false;
    req.on('close', () => {
      closed = true;
    });
    initSse(res);
    try {
      for await (const event of this.service.mapStory(user.id, storyId, dto)) {
        // A writer who navigated away should not keep paying for analyses they will never
        // see. Everything already folded into the graph stays there.
        if (closed) return;
        // `sendSse` already stamps the event name onto the payload as `type`; spreading
        // `kind` as well would hand the client two names for the same discriminator.
        const { kind, ...payload } = event;
        sendSse(res, kind, payload);
      }
    } catch (error) {
      sendSse(res, 'error', {
        code: error instanceof AppException ? error.code : 'STORY_MAP_FAILED',
        message: error instanceof Error ? error.message : 'mapping failed',
      });
    } finally {
      res.end();
    }
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
    // Asserted HERE, not inside `service.getGraph` — that method is also the reuse
    // seam `getGraphSnapshot` calls for Recommendations and Ask My Book, both
    // confirmed free by the same D4 decision (docs/48 §5.2). This route has no other
    // caller, so gating it at this one call site is exact.
    await this.service.assertGraphReadEntitled(user.id);
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
