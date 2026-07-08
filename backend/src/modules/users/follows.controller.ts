import {
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
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import {
  FollowActionResponseDto,
  FollowRequestDto,
  UserSummaryDto,
} from './dto/follow-response.dto';
import { FollowService } from './follow.service';

/**
 * Follow graph HTTP surface (docs 05, docs 04 §3.6). Follow/unfollow + request
 * accept/reject are authenticated (global guard); follower/following lists are
 * `@Public()` + `OptionalAuthGuard` (private accounts require the viewer to be an
 * accepted follower — enforced in the service). List responses use the ADR §5
 * cursor envelope.
 */
@ApiTags('follows')
@Controller()
export class FollowsController {
  constructor(private readonly followService: FollowService) {}

  @Post('users/:id/follow')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow a user (public → accepted, private → pending request).' })
  @ApiOkResponse({ type: FollowActionResponseDto })
  follow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) targetId: string,
  ): Promise<FollowActionResponseDto> {
    return this.followService.follow(user.id, targetId);
  }

  @Delete('users/:id/follow')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unfollow a user or cancel a pending request (idempotent).' })
  async unfollow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) targetId: string,
  ): Promise<void> {
    await this.followService.unfollowOrCancel(user.id, targetId);
  }

  @Get('me/follow-requests')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List incoming pending follow requests (cursor-paginated).' })
  @ApiOkResponse({ type: [FollowRequestDto] })
  async requests(@CurrentUser() user: AuthenticatedUser, @Query() query: CursorPaginationDto) {
    const page = await this.followService.listRequests(user.id, query.cursor, query.limit);
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  @Patch('follow-requests/:id/accept')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a follow request.' })
  async accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) followId: string,
  ): Promise<{ accepted: true }> {
    await this.followService.acceptRequest(followId, user.id);
    return { accepted: true };
  }

  @Patch('follow-requests/:id/reject')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a follow request.' })
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) followId: string,
  ): Promise<{ rejected: true }> {
    await this.followService.rejectRequest(followId, user.id);
    return { rejected: true };
  }

  @Get('users/:username/followers')
  @Public()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'List a user’s followers (cursor-paginated; respects privacy).' })
  @ApiOkResponse({ type: [UserSummaryDto] })
  async followers(
    @Param('username') username: string,
    @Query() query: CursorPaginationDto,
    @Req() req: Request,
  ) {
    const viewer = (req as Request & { user?: AuthenticatedUser }).user;
    const page = await this.followService.getFollowers(
      username,
      viewer?.id ?? null,
      query.cursor,
      query.limit,
    );
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  @Get('users/:username/following')
  @Public()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'List who a user follows (cursor-paginated; respects privacy).' })
  @ApiOkResponse({ type: [UserSummaryDto] })
  async following(
    @Param('username') username: string,
    @Query() query: CursorPaginationDto,
    @Req() req: Request,
  ) {
    const viewer = (req as Request & { user?: AuthenticatedUser }).user;
    const page = await this.followService.getFollowing(
      username,
      viewer?.id ?? null,
      query.cursor,
      query.limit,
    );
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }
}
