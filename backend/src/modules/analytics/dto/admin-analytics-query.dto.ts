import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsISO8601, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { ADMIN_TREND_RANGES } from '../analytics.constants';

/** Datasets the export endpoint can stream. */
export const ADMIN_ANALYTICS_DATASETS = [
  'overview',
  'users',
  'content',
  'engagement',
  'moderation',
  'system',
] as const;

/**
 * Shared filters for the admin analytics reads (E12.9). `range` is a preset;
 * `custom` uses `from`/`to`. `language`/`genre` narrow content/engagement queries
 * (backed by data). `country`/`device`/`platform` are ACCEPTED for a stable A8
 * contract but are currently **inert** — the tracking model captures no geo/device
 * dimension (documented; would require a tracking-schema change, out of scope).
 */
export class AdminAnalyticsQueryDto {
  @ApiPropertyOptional({
    enum: ADMIN_TREND_RANGES,
    default: '30d',
    description: 'Trend window preset; `custom` uses from/to.',
  })
  @IsOptional()
  @IsIn(ADMIN_TREND_RANGES)
  range: (typeof ADMIN_TREND_RANGES)[number] = '30d';

  @ApiPropertyOptional({
    description: 'Custom range start (ISO 8601); required when range=custom.',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Custom range end (ISO 8601); required when range=custom.' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ description: 'Language code filter (e.g. hi, ur, en).' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({ description: 'Genre slug filter.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  genre?: string;

  @ApiPropertyOptional({ description: 'Country filter — inert (geo not tracked).' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  country?: string;

  @ApiPropertyOptional({ description: 'Device filter — inert (device not tracked).' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  device?: string;

  @ApiPropertyOptional({ description: 'Platform filter — inert (platform not tracked).' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  platform?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10, description: 'Top-N list size.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;
}

/** `GET /admin/analytics/export` — a dataset + format on top of the shared filters. */
export class AdminAnalyticsExportQueryDto extends AdminAnalyticsQueryDto {
  @ApiPropertyOptional({
    enum: ADMIN_ANALYTICS_DATASETS,
    default: 'overview',
    description: 'Which analytics dataset to export.',
  })
  @IsOptional()
  @IsIn(ADMIN_ANALYTICS_DATASETS)
  dataset: (typeof ADMIN_ANALYTICS_DATASETS)[number] = 'overview';

  @ApiPropertyOptional({ enum: ['csv', 'json'], default: 'csv', description: 'Export format.' })
  @IsOptional()
  @IsIn(['csv', 'json'])
  format: 'csv' | 'json' = 'csv';
}
