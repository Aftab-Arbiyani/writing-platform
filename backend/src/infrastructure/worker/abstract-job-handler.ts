import { UnrecoverableError } from 'bullmq';

import type { JobContext, JobHandler } from '../../common/queue/job-handler';
import type { JobName } from '../../common/queue/queue.constants';
import type { JobPayloads } from '../../common/queue/job-payloads';

/**
 * Base class for every typed job handler (the user's "job classes"). A subclass
 * declares its `job` name, a `validate` (the payload DTO check — zod at the queue
 * boundary, exactly like a class-validator DTO at the HTTP boundary), and a
 * `handle` (the job logic, which reuses an exported business service).
 *
 * `run` bridges the two and normalizes failure: a payload that fails validation
 * is a PERMANENT error (retrying a malformed/stale job never helps), so it is
 * wrapped in BullMQ's `UnrecoverableError` → the job dead-letters immediately
 * instead of burning its whole retry budget. Cross-cutting logging + metrics live
 * in `BaseProcessor`, so handlers stay focused on validate + handle only.
 */
export abstract class AbstractJobHandler<J extends JobName> implements JobHandler<J> {
  abstract readonly job: J;

  abstract validate(raw: unknown): JobPayloads[J];
  abstract handle(data: JobPayloads[J], ctx: JobContext): Promise<unknown>;

  async run(raw: unknown, ctx: JobContext): Promise<unknown> {
    let data: JobPayloads[J];
    try {
      data = this.validate(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'invalid payload';
      throw new UnrecoverableError(`invalid "${this.job}" payload: ${message}`);
    }
    return this.handle(data, ctx);
  }
}
