import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * `POST /analytics/pieces/:id/view` body. For anonymous viewers the client may
 * send a stable `sessionId` (dedup key); otherwise the server derives one from
 * IP + user-agent. Authenticated views key on the user id.
 */
export class RecordViewDto {
  @ApiPropertyOptional({ description: 'Client session/fingerprint for anonymous dedup.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;
}

/**
 * `POST /analytics/pieces/:id/read` body — a completed read session. A read
 * "counts as completed" when dwell ≥30 s AND completion ≥50 % (server-applied).
 */
export class RecordReadDto {
  @ApiProperty({ description: 'Dwell time in seconds.', minimum: 0, example: 95 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24 * 60 * 60)
  durationSeconds!: number;

  @ApiProperty({ description: 'Scroll completion percentage (0–100).', minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  completionPct!: number;

  @ApiPropertyOptional({ description: 'Client session/fingerprint for anonymous reads.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;
}
