import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { OffsetPaginationDto } from '../../../common/dto/offset-pagination.dto';
import { QUEUE_NAMES, type QueueName } from '../../../common/queue/queue.constants';

/** Valid job states for the `state` filter (`all` = every state). */
export const JOB_STATE_FILTERS = [
  'all',
  'waiting',
  'active',
  'completed',
  'failed',
  'delayed',
  'paused',
] as const;
export type JobStateFilter = (typeof JOB_STATE_FILTERS)[number];

/** Query for `GET /admin/jobs` — which queue, which state, paginated. */
export class JobQueryDto extends OffsetPaginationDto {
  @ApiProperty({ enum: QUEUE_NAMES, description: 'Queue to inspect.' })
  @IsIn(QUEUE_NAMES)
  queue!: QueueName;

  @ApiPropertyOptional({
    enum: JOB_STATE_FILTERS,
    default: 'all',
    description: 'Filter jobs by state.',
  })
  @IsOptional()
  @IsIn(JOB_STATE_FILTERS)
  state: JobStateFilter = 'all';
}
