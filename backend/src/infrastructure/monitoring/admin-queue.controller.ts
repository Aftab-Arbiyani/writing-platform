import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { Permissions } from '../../modules/permissions/permissions.decorator';
import { JobDto } from './dto/job.dto';
import { JobQueryDto } from './dto/job-query.dto';
import { QueueStatusDto } from './dto/queue-status.dto';
import {
  JobNotFoundException,
  JobNotRetryableException,
  QueueNotFoundException,
} from './monitoring.exceptions';
import { QueueMonitorService } from './queue-monitor.service';
import { QueueRegistry } from '../queue/queue-registry.service';

/**
 * Queue & job monitoring for operators (docs 14 §5). Read views require
 * `admin.dashboard` (admin+, mirroring the docs' `@Roles(ADMIN)` gate on
 * bull-board); the destructive retry action requires `system.manage`
 * (super-admin) since replaying a job re-runs a side-effect. All admin-only —
 * the global `JwtAuthGuard` authenticates, `@Permissions` authorizes.
 */
@ApiTags('admin-queues')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(RateLimitGuard)
export class AdminQueueController {
  constructor(
    private readonly monitor: QueueMonitorService,
    private readonly registry: QueueRegistry,
  ) {}

  @Get('queues')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({
    summary:
      'Queue status for every queue (depth by state, oldest-waiting age, worker count). Requires `admin.dashboard`.',
  })
  @ApiOkResponse({ type: [QueueStatusDto] })
  listQueues(): Promise<QueueStatusDto[]> {
    return this.monitor.listQueues();
  }

  @Get('queues/:name')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({
    summary: 'Status of a single queue. Requires `admin.dashboard`. Errors: QUEUE_NOT_FOUND (404).',
  })
  @ApiOkResponse({ type: QueueStatusDto })
  queue(@Param('name') name: string): Promise<QueueStatusDto> {
    if (!this.registry.has(name)) {
      throw new QueueNotFoundException(name);
    }
    return this.monitor.queueStatus(name);
  }

  @Get('jobs')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({
    summary:
      'List jobs in a queue, filtered by state, paginated. Requires `admin.dashboard`. Errors: QUEUE_NOT_FOUND (404).',
  })
  @ApiOkResponse({ type: [JobDto] })
  async jobs(@Query() query: JobQueryDto) {
    if (!this.registry.has(query.queue)) {
      throw new QueueNotFoundException(query.queue);
    }
    const items = await this.monitor.listJobs(
      query.queue,
      query.state === 'all' ? 'all' : query.state,
      query.offset,
      query.limit,
    );
    return {
      success: true as const,
      data: items,
      meta: { pagination: { page: query.page, limit: query.limit } },
    };
  }

  @Post('jobs/retry/:id')
  @Permissions(PERMISSIONS.SystemManage)
  @RateLimit('write')
  @ApiOperation({
    summary:
      'Replay a failed (dead-lettered) job. Requires `system.manage`. Errors: QUEUE_NOT_FOUND (404), JOB_NOT_FOUND (404), JOB_NOT_RETRYABLE (409).',
  })
  @ApiOkResponse({ description: 'Job re-queued for processing.' })
  async retry(@Param('id') id: string, @Query() query: JobQueryDto): Promise<{ retried: true }> {
    if (!this.registry.has(query.queue)) {
      throw new QueueNotFoundException(query.queue);
    }
    const job = await this.monitor.getJob(query.queue, id);
    if (job === null) {
      throw new JobNotFoundException(id);
    }
    const retried = await this.monitor.retryJob(query.queue, id);
    if (!retried) {
      throw new JobNotRetryableException();
    }
    return { retried: true };
  }
}
