import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { Permissions } from '../permissions/permissions.decorator';
import { KeyManagementService } from './key-management.service';
import type { KeyStatus } from './key-management.service';
import { SecurityPlatformService } from './security-platform.service';
import type { SecurityPlatformStatus } from './security-platform.service';

/**
 * Admin security surface (P7.2) — feeds the admin Security Dashboard. Read-only
 * posture + key-status views; the security *event* feed is the existing
 * `/admin/audit-logs` browser (security/privacy categories), NOT re-implemented
 * here. Admin-gated (`admin.dashboard`); the global JwtAuthGuard authenticates.
 * Never exposes a secret or key material — only non-secret status.
 */
@ApiTags('admin-security')
@ApiBearerAuth()
@Controller('admin/security')
@UseGuards(RateLimitGuard)
export class SecurityAdminController {
  constructor(
    private readonly platform: SecurityPlatformService,
    private readonly keys: KeyManagementService,
  ) {}

  @Get('status')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'Security Platform posture (controls, lockout + threat policy).' })
  @ApiOkResponse({ description: 'Security posture snapshot.' })
  status(): Promise<SecurityPlatformStatus> {
    return this.platform.status();
  }

  @Get('keys')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'Encryption key status (non-secret: id/active/algorithm/length).' })
  @ApiOkResponse({ description: 'Key statuses.' })
  keyStatuses(): { maxKeyAgeDays: number; keys: KeyStatus[] } {
    return { maxKeyAgeDays: this.keys.maxKeyAgeDays, keys: this.keys.statuses() };
  }
}
