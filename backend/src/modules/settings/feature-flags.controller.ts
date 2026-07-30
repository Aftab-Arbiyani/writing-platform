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
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';

import { CreateFeatureFlagDto, FeatureFlagDto, UpdateFeatureFlagDto } from './dto/feature-flag.dto';
import { SettingsService } from './settings.service';
import { buildActor } from './settings.util';

/**
 * Admin Feature Flags surface (E12.8) — the richer, per-flag rollout model that
 * dark-launches Phase-2+ capabilities (AI, Payments, Mobile, Creator Economy).
 * Gated on `settings.manage`; every mutation is audited + cache-invalidated.
 */
@ApiTags('admin-feature-flags')
@ApiBearerAuth()
@Controller('admin/feature-flags')
@UseGuards(RateLimitGuard)
export class FeatureFlagsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('read')
  @ApiOperation({ summary: 'List all feature flags.' })
  @ApiOkResponse({ type: [FeatureFlagDto] })
  list(): Promise<FeatureFlagDto[]> {
    return this.settings.getFeatureFlags();
  }

  @Post()
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Create a feature flag.' })
  @ApiCreatedResponse({ type: FeatureFlagDto })
  create(
    @Body() dto: CreateFeatureFlagDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<FeatureFlagDto> {
    return this.settings.createFeatureFlag(dto, buildActor(user, req));
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Update a feature flag (enable/disable, rollout, environment).' })
  @ApiOkResponse({ type: FeatureFlagDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeatureFlagDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<FeatureFlagDto> {
    return this.settings.updateFeatureFlag(id, dto, buildActor(user, req));
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a feature flag.' })
  @ApiNoContentResponse()
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.settings.deleteFeatureFlag(id, buildActor(user, req));
  }
}
