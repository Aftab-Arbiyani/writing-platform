import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Visibility } from '@qalam/shared';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** Reviewer notes may be long-form but bounded. */
const REVIEW_NOTES_MAX = 5_000;

/**
 * `POST /stories/:id/schedule` body. The future-date rule is enforced downstream
 * by `PiecesService.schedule` (`PIECE_SCHEDULE_IN_PAST`).
 */
export class SchedulePublicationDto {
  @ApiProperty({ format: 'date-time', example: '2026-08-01T09:00:00.000Z' })
  @IsDateString()
  scheduledAt!: string;
}

/** `PATCH /stories/:id/visibility` body. */
export class ChangeVisibilityDto {
  @ApiProperty({ enum: Object.values(Visibility), description: 'New story visibility.' })
  @IsIn(Object.values(Visibility))
  visibility!: Visibility;
}

/** `POST /stories/:id/review/changes` body — reviewer notes are optional. */
export class RequestChangesDto {
  @ApiPropertyOptional({ description: 'What the author should change before approval.' })
  @IsOptional()
  @IsString()
  @MaxLength(REVIEW_NOTES_MAX)
  notes?: string;
}
