import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';
import type { Request } from 'express';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';
import { AnalyticsService } from './analytics.service';
import { GenerateSnapshotDto, GrowthQueryDto, TrendingQueryDto } from './dto/analytics-query.dto';
import {
  DashboardDto,
  GrowthSeriesDto,
  PieceAnalyticsDto,
  PlatformAnalyticsDto,
  ReaderAnalyticsDto,
  SnapshotResultDto,
  TrendingDto,
  WriterAnalyticsDto,
} from './dto/analytics-response.dto';
import { RecordReadDto, RecordViewDto } from './dto/track.dto';

/**
 * Analytics & Insights (E10). Tracking endpoints (`/view`, `/read`) are public +
 * optional-auth: they EMIT domain events; the listener aggregates. Read endpoints
 * serve aggregates (fast). Own analytics are self-scoped (`@CurrentUser`); piece
 * analytics are owner-only; platform + snapshots require `analytics.view` (PBAC).
 * All rate-limited. Thin controller (docs 16 §3.6).
 */
@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  private viewer(req: Request): { id: string } | null {
    const user = (req as Request & { user?: AuthenticatedUser }).user;
    return user !== undefined ? { id: user.id } : null;
  }

  private fingerprint(req: Request, sessionId?: string): string {
    return sessionId ?? `${req.ip ?? 'unknown'}|${req.headers['user-agent'] ?? 'unknown'}`;
  }

  // ── Tracking (emit events) ─────────────────────────────────────────────────

  @Post('pieces/:id/view')
  @Public()
  @UseGuards(OptionalAuthGuard, RateLimitGuard)
  @RateLimit('read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Track a piece view (dedup by viewer within a cooldown; anonymous or authenticated).',
  })
  @ApiNoContentResponse()
  async trackView(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordViewDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.analytics.recordView(id, this.viewer(req), this.fingerprint(req, dto.sessionId));
  }

  @Post('pieces/:id/read')
  @Public()
  @UseGuards(OptionalAuthGuard, RateLimitGuard)
  @RateLimit('read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Track a completed read (duration + completion %). Applies read thresholds.',
  })
  @ApiNoContentResponse()
  async trackRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordReadDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.analytics.recordRead(id, this.viewer(req), dto);
  }

  // ── Own analytics (self-scoped) ─────────────────────────────────────────────

  @Get('me')
  @UseGuards(RateLimitGuard)
  @RateLimit('read')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Your writer analytics (views, reads, engagement received, most popular).',
  })
  @ApiOkResponse({ type: WriterAnalyticsDto })
  me(@CurrentUser() user: AuthenticatedUser): Promise<WriterAnalyticsDto> {
    return this.analytics.getWriterAnalytics(user.id);
  }

  @Get('me/growth')
  @UseGuards(RateLimitGuard)
  @RateLimit('read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Your growth over time (from snapshots).' })
  @ApiOkResponse({ type: GrowthSeriesDto })
  myGrowth(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GrowthQueryDto,
  ): Promise<GrowthSeriesDto> {
    return this.analytics.getWriterGrowth(user.id, query);
  }

  @Get('readers/me')
  @UseGuards(RateLimitGuard)
  @RateLimit('read')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Your reader analytics (pieces read, streak, favorite genres/languages).',
  })
  @ApiOkResponse({ type: ReaderAnalyticsDto })
  readerMe(@CurrentUser() user: AuthenticatedUser): Promise<ReaderAnalyticsDto> {
    return this.analytics.getReaderAnalytics(user.id);
  }

  @Get('dashboard')
  @UseGuards(RateLimitGuard)
  @RateLimit('read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Your combined writer + reader dashboard.' })
  @ApiOkResponse({ type: DashboardDto })
  dashboard(@CurrentUser() user: AuthenticatedUser): Promise<DashboardDto> {
    return this.analytics.getDashboard(user.id);
  }

  @Get('pieces/:id')
  @UseGuards(RateLimitGuard)
  @RateLimit('read')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Analytics for one of your pieces (owner only). Errors: PIECE_NOT_FOUND (404), PIECE_FORBIDDEN (403).',
  })
  @ApiOkResponse({ type: PieceAnalyticsDto })
  piece(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PieceAnalyticsDto> {
    return this.analytics.getPieceAnalytics(id, user.id);
  }

  // ── Trending (public) ──────────────────────────────────────────────────────

  @Get('trending')
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit('read')
  @ApiOperation({ summary: 'Trending pieces/writers/genres/tags (daily|weekly|monthly). Cached.' })
  @ApiOkResponse({ type: TrendingDto })
  trending(@Query() query: TrendingQueryDto): Promise<TrendingDto> {
    return this.analytics.getTrending(query);
  }

  // ── Platform (admin: analytics.view) ────────────────────────────────────────

  @Get('platform')
  @UseGuards(RateLimitGuard)
  @Permissions(PERMISSIONS.AnalyticsView)
  @RateLimit('read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Platform-wide analytics. Requires `analytics.view`. Cached.' })
  @ApiOkResponse({ type: PlatformAnalyticsDto })
  platform(): Promise<PlatformAnalyticsDto> {
    return this.analytics.getPlatformAnalytics();
  }

  @Get('platform/growth')
  @UseGuards(RateLimitGuard)
  @Permissions(PERMISSIONS.AnalyticsView)
  @RateLimit('read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Platform growth trends (from snapshots). Requires `analytics.view`.' })
  @ApiOkResponse({ type: GrowthSeriesDto })
  platformGrowth(@Query() query: GrowthQueryDto): Promise<GrowthSeriesDto> {
    return this.analytics.getPlatformGrowth(query);
  }

  @Post('snapshots')
  @UseGuards(RateLimitGuard)
  @Permissions(PERMISSIONS.AnalyticsView)
  @RateLimit('write')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Generate platform + writer snapshots for a period (on demand). Requires `analytics.view`.',
  })
  @ApiCreatedResponse({ type: SnapshotResultDto })
  generateSnapshots(@Body() dto: GenerateSnapshotDto): Promise<SnapshotResultDto> {
    return this.analytics.generateSnapshots(dto.period);
  }
}
