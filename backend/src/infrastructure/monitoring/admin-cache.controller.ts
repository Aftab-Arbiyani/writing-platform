import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { Permissions } from '../../modules/permissions/permissions.decorator';
import { CacheService } from '../cache/cache.service';
import { CacheWarmerService } from '../cache/cache-warmer.service';
import type { WarmResult } from '../cache/cache-warmer.service';
import { WARMABLE_CACHES } from '../cache/cache.constants';
import { CacheStatusDto, ClearCacheDto, WarmCacheDto } from './dto/cache.dto';

/**
 * Cache administration (Epic 11). Inspection requires `admin.dashboard`;
 * mutating actions (clear/warm) require `system.manage` (super-admin), since a
 * cache flush is a system-wide operation. All admin-only.
 */
@ApiTags('admin-cache')
@ApiBearerAuth()
@Controller('admin/cache')
@UseGuards(RateLimitGuard)
export class AdminCacheController {
  constructor(
    private readonly cache: CacheService,
    private readonly warmer: CacheWarmerService,
  ) {}

  @Get()
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({
    summary:
      'Cache DB snapshot: key counts by prefix, memory, warmable groups. Requires `admin.dashboard`.',
  })
  @ApiOkResponse({ type: CacheStatusDto })
  async status(): Promise<CacheStatusDto> {
    const stats = await this.cache.stats();
    return { ...stats, warmable: WARMABLE_CACHES.map((w) => ({ ...w })) };
  }

  @Post('clear')
  @Permissions(PERMISSIONS.SystemManage)
  @HttpCode(HttpStatus.OK)
  @RateLimit('write')
  @ApiOperation({
    summary:
      'Clear a cache prefix, or flush the whole cache DB if no prefix is given. Requires `system.manage`.',
  })
  @ApiOkResponse({ description: 'Number of keys removed (or "all" on a full flush).' })
  async clear(@Body() dto: ClearCacheDto): Promise<{ cleared: number | 'all' }> {
    if (dto.prefix !== undefined && dto.prefix !== '') {
      return { cleared: await this.cache.delByPrefix(dto.prefix) };
    }
    await this.cache.flushAll();
    return { cleared: 'all' };
  }

  @Post('warm')
  @Permissions(PERMISSIONS.SystemManage)
  @HttpCode(HttpStatus.OK)
  @RateLimit('write')
  @ApiOperation({
    summary:
      'Warm a cache group, or all warmable caches if no target is given. Requires `system.manage`.',
  })
  @ApiOkResponse({ description: 'Per-target warm results.' })
  async warm(@Body() dto: WarmCacheDto): Promise<{ results: WarmResult[] }> {
    if (dto.target !== undefined) {
      return { results: [await this.warmer.warm(dto.target)] };
    }
    return { results: await this.warmer.warmAll() };
  }
}
