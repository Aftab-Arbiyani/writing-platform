import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';
import type { Request } from 'express';

import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';
import { CommentsService } from './comments.service';
import { CommentResponseDto } from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

/**
 * Comments HTTP surface (E7). Writes are authenticated (global JwtAuthGuard);
 * reads are `@Public()` + `OptionalAuthGuard` (anyone can read comments on a
 * visible piece). Ownership/visibility live in the service. Thin controller.
 */
@ApiTags('comments')
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post('pieces/:id/comments')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.CommentCreate)
  @ApiOperation({
    summary: 'Comment on a piece (piece must be published). Requires `comment.create`.',
  })
  @ApiCreatedResponse({ type: CommentResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) pieceId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.comments.create(pieceId, user.id, dto);
  }

  @Get('pieces/:id/comments')
  @Public()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'List top-level comments on a piece (cursor-paginated).' })
  @ApiOkResponse({ type: [CommentResponseDto] })
  async list(
    @Param('id', ParseUUIDPipe) pieceId: string,
    @Query() query: CursorPaginationDto,
    @Req() req: Request,
  ) {
    const viewer = (req as Request & { user?: AuthenticatedUser }).user;
    const page = await this.comments.listForPiece(
      pieceId,
      viewer?.id ?? null,
      query.cursor,
      query.limit,
    );
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  @Post('comments/:id/replies')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.CommentCreate)
  @ApiOperation({
    summary: 'Reply to a comment (nesting capped at MAX_COMMENT_DEPTH). Requires `comment.create`.',
  })
  @ApiCreatedResponse({ type: CommentResponseDto })
  reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) parentId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.comments.reply(parentId, user.id, dto);
  }

  @Get('comments/:id/replies')
  @Public()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'List replies to a comment (cursor-paginated).' })
  @ApiOkResponse({ type: [CommentResponseDto] })
  async replies(
    @Param('id', ParseUUIDPipe) parentId: string,
    @Query() query: CursorPaginationDto,
    @Req() req: Request,
  ) {
    const viewer = (req as Request & { user?: AuthenticatedUser }).user;
    const page = await this.comments.listReplies(
      parentId,
      viewer?.id ?? null,
      query.cursor,
      query.limit,
    );
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  @Patch('comments/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit a comment (owner only; records the edit timestamp).' })
  @ApiOkResponse({ type: CommentResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.comments.update(id, user.id, dto);
  }

  @Delete('comments/:id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a comment (owner or moderator+); replies stay visible.' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.comments.delete(id, user.id, user.role);
  }
}
