import { ApiProperty } from '@nestjs/swagger';

/** A single job's monitoring view for `GET /admin/jobs`. */
export class JobDto {
  @ApiProperty({ description: 'Job id (unique within its queue).' })
  id!: string;

  @ApiProperty({ description: 'Job name (the job type within the queue).' })
  name!: string;

  @ApiProperty({ description: 'Owning queue.' })
  queue!: string;

  @ApiProperty({
    description: 'Current state (waiting/active/completed/failed/delayed/paused).',
  })
  state!: string;

  @ApiProperty({ description: 'Processing attempts made so far (retry count).' })
  attemptsMade!: number;

  @ApiProperty({ description: 'Configured maximum attempts before dead-lettering.' })
  maxAttempts!: number;

  @ApiProperty({ description: 'Unix ms when the job was enqueued.' })
  timestamp!: number;

  @ApiProperty({ nullable: true, description: 'Unix ms when processing began.' })
  processedOn!: number | null;

  @ApiProperty({ nullable: true, description: 'Unix ms when processing finished.' })
  finishedOn!: number | null;

  @ApiProperty({ description: 'Configured delay in ms (delayed jobs).' })
  delay!: number;

  @ApiProperty({ nullable: true, description: 'Failure reason, if the last attempt failed.' })
  failedReason!: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Job payload.' })
  data!: unknown;
}
