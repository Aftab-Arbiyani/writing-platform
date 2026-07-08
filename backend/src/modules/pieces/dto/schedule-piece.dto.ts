import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

/**
 * `POST /pieces/:id/schedule` body. The service enforces the future-date rule
 * (`PIECE_SCHEDULE_IN_PAST`). Background publishing is a later epic — E4 stores
 * the schedule only (docs 18 E4 task 3).
 */
export class SchedulePieceDto {
  @ApiProperty({ format: 'date-time', example: '2026-08-01T09:00:00.000Z' })
  @IsDateString()
  scheduledAt!: string;
}
