import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { WARMABLE_CACHES, type WarmableKey } from '../../cache/cache.constants';

const WARMABLE_KEYS = WARMABLE_CACHES.map((w) => w.key);

/** A warmable cache group (advertised in the cache status view). */
export class WarmableCacheDto {
  @ApiProperty({ description: 'Group key (target for warm/refresh).' })
  key!: string;

  @ApiProperty({ description: 'Human-readable label.' })
  label!: string;

  @ApiProperty({ description: 'Redis key prefix the group lives under.' })
  prefix!: string;
}

/** `GET /admin/cache` — cache DB snapshot. */
export class CacheStatusDto {
  @ApiProperty({ description: 'Total keys in the cache DB (Redis DB 0).' })
  keys!: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Key counts grouped by top-level `prefix:` namespace.',
  })
  byPrefix!: Record<string, number>;

  @ApiProperty({ nullable: true, description: 'Redis used_memory_human.' })
  usedMemory!: string | null;

  @ApiProperty({ type: [WarmableCacheDto], description: 'Warmable cache groups.' })
  warmable!: WarmableCacheDto[];
}

/** `POST /admin/cache/clear` — clear a prefix, or the whole cache DB if omitted. */
export class ClearCacheDto {
  @ApiPropertyOptional({
    description: 'Key prefix to clear (e.g. "feed:"). Omit to flush the entire cache DB.',
    example: 'feed:',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  prefix?: string;
}

/** `POST /admin/cache/warm` — warm one group, or all if omitted. */
export class WarmCacheDto {
  @ApiPropertyOptional({
    enum: WARMABLE_KEYS,
    description: 'Cache group to warm. Omit to warm all.',
  })
  @IsOptional()
  @IsIn(WARMABLE_KEYS)
  target?: WarmableKey;
}
