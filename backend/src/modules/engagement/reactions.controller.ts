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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';
import type { Request } from 'express';

import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';
import {
  BookmarkItemDto,
  BookmarkResponseDto,
  ClapDto,
  ClapResponseDto,
  LikeResponseDto,
} from './dto/reaction.dto';
import { PieceEngagementDto } from './dto/piece-engagement.dto';
import { PieceStatsService } from './piece-stats.service';
import { ReactionsService } from './reactions.service';

/**
 * Likes / claps / bookmarks HTTP surface (E7). All mutations are authenticated
 * (global JwtAuthGuard); the engagement summary is `@Public()` (viewer state is
 * empty for anonymous readers). Counts come from `piece_stats` (O(1)).
 */
@ApiTags('engagement')
@Controller()
export class ReactionsController {
  constructor(
    private readonly reactions: ReactionsService,
    private readonly stats: PieceStatsService,
  ) {}

  // ── likes ────────────────────────────────────────────────────────────────

  @Post('pieces/:id/likes')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Like a piece (idempotent).' })
  @ApiOkResponse({ type: LikeResponseDto })
  like(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) pieceId: string,
  ): Promise<LikeResponseDto> {
    return this.reactions.like(pieceId, user.id);
  }

  @Delete('pieces/:id/likes')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlike a piece (idempotent).' })
  async unlike(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) pieceId: string,
  ): Promise<void> {
    await this.reactions.unlike(pieceId, user.id);
  }

  // ── claps ────────────────────────────────────────────────────────────────

  @Post('pieces/:id/claps')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.ClapCreate)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add claps (accumulates up to 50 per user per piece). Requires `clap.create`.',
  })
  @ApiOkResponse({ type: ClapResponseDto })
  clap(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) pieceId: string,
    @Body() dto: ClapDto,
  ): Promise<ClapResponseDto> {
    return this.reactions.clap(pieceId, user.id, dto.count);
  }

  @Delete('pieces/:id/claps')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove all of my claps from a piece.' })
  async unclap(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) pieceId: string,
  ): Promise<void> {
    await this.reactions.removeClaps(pieceId, user.id);
  }

  // ── bookmarks ──────────────────────────────────────────────────────────────

  @Post('pieces/:id/bookmarks')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.BookmarkManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bookmark a piece (private; idempotent). Requires `bookmark.manage`.' })
  @ApiOkResponse({ type: BookmarkResponseDto })
  bookmark(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) pieceId: string,
  ): Promise<BookmarkResponseDto> {
    return this.reactions.bookmark(pieceId, user.id);
  }

  @Delete('pieces/:id/bookmarks')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.BookmarkManage)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a bookmark (idempotent). Requires `bookmark.manage`.' })
  async removeBookmark(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) pieceId: string,
  ): Promise<void> {
    await this.reactions.removeBookmark(pieceId, user.id);
  }

  @Get('me/bookmarks')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my bookmarks (private; cursor-paginated).' })
  @ApiOkResponse({ type: [BookmarkItemDto] })
  async myBookmarks(@CurrentUser() user: AuthenticatedUser, @Query() query: CursorPaginationDto) {
    const page = await this.reactions.listBookmarks(user.id, query.cursor, query.limit);
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  // ── engagement summary ───────────────────────────────────────────────────

  @Get('pieces/:id/engagement')
  @Public()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Engagement counts + the viewer’s own like/clap/bookmark state.' })
  @ApiOkResponse({ type: PieceEngagementDto })
  engagement(
    @Param('id', ParseUUIDPipe) pieceId: string,
    @Req() req: Request,
  ): Promise<PieceEngagementDto> {
    const viewer = (req as Request & { user?: AuthenticatedUser }).user;
    return this.stats.getEngagement(pieceId, viewer?.id ?? null);
  }
}
