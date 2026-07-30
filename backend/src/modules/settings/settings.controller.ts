import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';
import type { Request } from 'express';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';

import { SettingDto } from './dto/setting-response.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SETTING_CATEGORIES } from './settings.constants';
import { SettingsService } from './settings.service';
import { buildActor } from './settings.util';

/**
 * Admin System Settings surface (E12.8). Reads/writes the generic key-value
 * configuration store; every mutation is audited and cache-invalidated by
 * `SettingsService`. Gated on `settings.manage` (admin+; docs 13 §4) behind the
 * global JWT guard and the rate-limit guard.
 */
@ApiTags('admin-settings')
@ApiBearerAuth()
@Controller('admin/settings')
@UseGuards(RateLimitGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('read')
  @ApiOperation({ summary: 'List every platform setting (all categories).' })
  @ApiOkResponse({ type: [SettingDto] })
  getAll(): Promise<SettingDto[]> {
    return this.settings.getAllSettings();
  }

  @Get(':category')
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('read')
  @ApiOperation({ summary: 'List settings in one category.' })
  @ApiParam({ name: 'category', enum: SETTING_CATEGORIES })
  @ApiOkResponse({ type: [SettingDto] })
  getByCategory(@Param('category') category: string): Promise<SettingDto[]> {
    return this.settings.getSettingsByCategory(category);
  }

  @Patch()
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Batch-update settings across any category.' })
  @ApiOkResponse({ type: [SettingDto], description: 'The updated settings.' })
  update(
    @Body() dto: UpdateSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<SettingDto[]> {
    return this.settings.updateSettings(dto.updates, buildActor(user, req), dto.reason);
  }

  @Patch(':category')
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Batch-update settings within one category (keys must belong to it).' })
  @ApiParam({ name: 'category', enum: SETTING_CATEGORIES })
  @ApiOkResponse({ type: [SettingDto], description: 'The updated settings.' })
  updateCategory(
    @Param('category') category: string,
    @Body() dto: UpdateSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<SettingDto[]> {
    return this.settings.updateSettingsByCategory(
      category,
      dto.updates,
      buildActor(user, req),
      dto.reason,
    );
  }
}
