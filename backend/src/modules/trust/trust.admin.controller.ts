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

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';

import { ApplyRestrictionDto, IssueStrikeDto } from './dto/trust-request.dto';
import { RestrictionDto, StrikeDto, TrustSummaryDto } from './dto/trust-response.dto';
import { TrustService } from './trust.service';
import { buildActor } from './trust.util';

/**
 * The moderator/admin Trust surface (AF6). `trust.view` gates the reads;
 * `trust.manage` gates every mutation (both held by moderator+ / admin). Every
 * mutation is audited and invalidates the Policy Engine cache inside the service —
 * the controller stays thin.
 */
@ApiTags('admin-trust')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(RateLimitGuard)
export class TrustAdminController {
  constructor(private readonly trust: TrustService) {}

  @Get('users/:id/trust')
  @Permissions(PERMISSIONS.TrustView)
  @RateLimit('read')
  @ApiOperation({ summary: "Inspect a user's trust standing." })
  @ApiOkResponse({ type: TrustSummaryDto })
  summary(@Param('id', ParseUUIDPipe) id: string): Promise<TrustSummaryDto> {
    // `inspectSummary`, not `getSummary`: this id came from a URL a human typed, so it
    // is proved against `users` before an answer is given, and no row is written on the
    // way (A2-4).
    return this.trust.inspectSummary(id);
  }

  @Get('users/:id/strikes')
  @Permissions(PERMISSIONS.TrustView)
  @RateLimit('read')
  @ApiOperation({ summary: "List a user's strikes (active + revoked + expired)." })
  @ApiOkResponse({ type: [StrikeDto] })
  strikes(@Param('id', ParseUUIDPipe) id: string): Promise<StrikeDto[]> {
    return this.trust.listStrikes(id);
  }

  @Get('users/:id/restrictions')
  @Permissions(PERMISSIONS.TrustView)
  @RateLimit('read')
  @ApiOperation({ summary: "List a user's restrictions (active + historical)." })
  @ApiOkResponse({ type: [RestrictionDto] })
  restrictions(@Param('id', ParseUUIDPipe) id: string): Promise<RestrictionDto[]> {
    return this.trust.listRestrictions(id);
  }

  @Post('users/:id/strikes')
  @Permissions(PERMISSIONS.TrustManage)
  @RateLimit('write')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Issue a policy strike (auto-escalates on the strike threshold).' })
  @ApiCreatedResponse({ type: StrikeDto })
  issueStrike(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: IssueStrikeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<StrikeDto> {
    return this.trust.issueStrike(id, body, buildActor(user, req));
  }

  @Post('users/:id/restrictions')
  @Permissions(PERMISSIONS.TrustManage)
  @RateLimit('write')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Apply an account restriction.' })
  @ApiCreatedResponse({ type: RestrictionDto })
  applyRestriction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ApplyRestrictionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<RestrictionDto> {
    return this.trust.applyRestriction(id, body, buildActor(user, req));
  }

  @Delete('strikes/:id')
  @Permissions(PERMISSIONS.TrustManage)
  @RateLimit('write')
  @ApiOperation({
    summary:
      'Revoke a strike (the only action that lowers active strike weight). Errors: NOT_FOUND (404), CONFLICT (409) if already revoked.',
  })
  @ApiOkResponse({ type: StrikeDto })
  revokeStrike(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<StrikeDto> {
    return this.trust.revokeStrike(id, buildActor(user, req));
  }

  @Delete('restrictions/:id')
  @Permissions(PERMISSIONS.TrustManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Lift an active restriction.' })
  @ApiOkResponse({ type: RestrictionDto })
  liftRestriction(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<RestrictionDto> {
    return this.trust.liftRestriction(id, buildActor(user, req));
  }
}
