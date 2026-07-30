import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';
import type { Request } from 'express';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';

import { MaintenanceDto, UpdateMaintenanceDto } from './dto/maintenance.dto';
import { SettingsService } from './settings.service';
import { buildActor } from './settings.util';

/**
 * Admin Maintenance Mode surface (E12.8). A thin, strongly-typed view over the
 * `maintenance.*` settings — no separate table (the generic store backs it).
 * Gated on `settings.manage`; each toggle is audited.
 */
@ApiTags('admin-maintenance')
@ApiBearerAuth()
@Controller('admin/maintenance')
@UseGuards(RateLimitGuard)
export class MaintenanceController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('read')
  @ApiOperation({ summary: 'Current maintenance-mode state.' })
  @ApiOkResponse({ type: MaintenanceDto })
  get(): Promise<MaintenanceDto> {
    return this.settings.getMaintenance();
  }

  @Patch()
  @Permissions(PERMISSIONS.SettingsManage)
  @RateLimit('write')
  @ApiOperation({
    summary: 'Enable/disable maintenance mode and its message/window/allowed roles.',
  })
  @ApiOkResponse({ type: MaintenanceDto })
  update(
    @Body() dto: UpdateMaintenanceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<MaintenanceDto> {
    return this.settings.updateMaintenance(dto, buildActor(user, req));
  }
}
