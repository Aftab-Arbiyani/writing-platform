import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsResponseDto } from './dto/settings-response.dto';
import { SettingsService } from './settings.service';

/**
 * Settings HTTP surface (docs 05). Authenticated (global JwtAuthGuard). The
 * DB-only preference bag; account privacy + compose language are on the profile.
 */
@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get the current user’s settings.' })
  @ApiOkResponse({ type: SettingsResponseDto })
  get(@CurrentUser() user: AuthenticatedUser): Promise<SettingsResponseDto> {
    return this.settingsService.get(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update theme, default visibility, or notification preferences.' })
  @ApiOkResponse({ type: SettingsResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ): Promise<SettingsResponseDto> {
    return this.settingsService.update(user.id, dto);
  }
}
