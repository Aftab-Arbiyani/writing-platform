import { ApiPropertyOptional } from '@nestjs/swagger';
import { AnalyticsPeriod, TrendType } from '@qalam/shared';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import { TOP_LIST_LIMIT } from '../analytics.constants';

/** `GET /analytics/trending` — window + optional entity filter + list size. */
export class TrendingQueryDto {
  @ApiPropertyOptional({
    enum: Object.values(AnalyticsPeriod),
    default: AnalyticsPeriod.Weekly,
    description: 'Window: daily (1d) | weekly (7d) | monthly (30d).',
  })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period: AnalyticsPeriod = AnalyticsPeriod.Weekly;

  @ApiPropertyOptional({
    enum: Object.values(TrendType),
    description: 'Restrict to one entity type; omit for all groups.',
  })
  @IsOptional()
  @IsEnum(TrendType)
  type?: TrendType;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: TOP_LIST_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = TOP_LIST_LIMIT;
}

/** `?period=&points=` for growth-over-time reads (from snapshots). */
export class GrowthQueryDto {
  @ApiPropertyOptional({ enum: Object.values(AnalyticsPeriod), default: AnalyticsPeriod.Daily })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period: AnalyticsPeriod = AnalyticsPeriod.Daily;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 90,
    default: 30,
    description: 'Number of snapshots.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  points: number = 30;
}

/** Admin snapshot generation trigger (no background jobs — run on demand). */
export class GenerateSnapshotDto {
  @ApiPropertyOptional({
    enum: Object.values(AnalyticsPeriod),
    default: AnalyticsPeriod.Daily,
    description: 'Which period bucket to snapshot into.',
  })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period: AnalyticsPeriod = AnalyticsPeriod.Daily;
}
