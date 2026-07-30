import { ApiProperty } from '@nestjs/swagger';

/** Job-count breakdown by state. */
export class QueueCountsDto {
  @ApiProperty({ description: 'Jobs waiting to be processed.' })
  waiting!: number;

  @ApiProperty({ description: 'Jobs currently being processed.' })
  active!: number;

  @ApiProperty({ description: 'Completed jobs retained in Redis.' })
  completed!: number;

  @ApiProperty({ description: 'Failed jobs — the dead-letter window.' })
  failed!: number;

  @ApiProperty({ description: 'Delayed jobs (scheduled for a future time).' })
  delayed!: number;

  @ApiProperty({ description: 'Jobs held while the queue is paused.' })
  paused!: number;
}

/** Per-queue status for `GET /admin/queues`. */
export class QueueStatusDto {
  @ApiProperty({ description: 'Queue name.' })
  name!: string;

  @ApiProperty({ description: 'Whether the queue is paused.' })
  paused!: boolean;

  @ApiProperty({ type: QueueCountsDto })
  counts!: QueueCountsDto;

  @ApiProperty({
    description:
      'Age of the oldest waiting job in ms — the stall detector (a low depth with a high age = a stuck queue).',
  })
  oldestWaitingAgeMs!: number;

  @ApiProperty({ description: 'Number of connected workers processing this queue.' })
  workers!: number;
}
