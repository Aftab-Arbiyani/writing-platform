import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

import { BlockDto, TrustSummaryDto } from './dto/trust-response.dto';
import { TrustService } from './trust.service';

/**
 * The user-facing Trust surface (AF6): a user sees their own standing and manages
 * their personal block/mute list. Authenticated by the global `JwtAuthGuard` (no
 * special permission — a user only ever acts on their own account); write-tier
 * rate limited. Thin controller — the service owns every invariant and returns
 * plain DTOs that the global interceptor wraps in the response envelope.
 */
@ApiTags('trust')
@ApiBearerAuth()
@Controller()
@UseGuards(RateLimitGuard)
export class TrustController {
  constructor(private readonly trust: TrustService) {}

  @Get('me/trust')
  @RateLimit('read')
  @ApiOperation({ summary: "Get the current user's trust summary." })
  @ApiOkResponse({ type: TrustSummaryDto })
  summary(@CurrentUser() user: AuthenticatedUser): Promise<TrustSummaryDto> {
    return this.trust.getSummary(user.id);
  }

  @Get('me/blocks')
  @RateLimit('read')
  @ApiOperation({ summary: 'List the users the current user has blocked or muted.' })
  @ApiOkResponse({ type: [BlockDto] })
  blocks(@CurrentUser() user: AuthenticatedUser): Promise<BlockDto[]> {
    return this.trust.listBlocks(user.id);
  }

  @Post('users/:id/block')
  @RateLimit('write')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Block a user (severs interaction both ways).' })
  @ApiCreatedResponse({ type: BlockDto })
  block(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BlockDto> {
    return this.trust.block(user.id, id);
  }

  @Delete('users/:id/block')
  @RateLimit('write')
  @ApiOperation({ summary: 'Remove a block.' })
  @ApiOkResponse({ description: 'Block removed.' })
  unblock(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.trust.unblock(user.id, id);
  }

  @Post('users/:id/mute')
  @RateLimit('write')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Mute a user (hides them from the current user only).' })
  @ApiCreatedResponse({ type: BlockDto })
  mute(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BlockDto> {
    return this.trust.mute(user.id, id);
  }

  @Delete('users/:id/mute')
  @RateLimit('write')
  @ApiOperation({ summary: 'Remove a mute.' })
  @ApiOkResponse({ description: 'Mute removed.' })
  unmute(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.trust.unmute(user.id, id);
  }
}
