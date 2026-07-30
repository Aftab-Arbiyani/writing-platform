import type { JobName } from './queue.constants';
import type { JobPayloads } from './job-payloads';

/** Correlation context handed to a handler (child-logger fields, docs 14 §1.5). */
export interface JobContext {
  requestId: string;
  jobId: string;
  /** 1-based attempt number for this execution. */
  attempt: number;
}

/**
 * The non-generic surface a queue's worker dispatches to — one per job name. Its
 * `run` erases the payload type (takes `unknown`), so a queue's WorkerHost can
 * hold a `Map<jobName, JobRunner>` of differently-typed handlers without fighting
 * the type system. The concrete, type-safe validate/handle split lives in
 * `AbstractJobHandler`, whose `run` bridges the two.
 */
export interface JobRunner {
  readonly job: JobName;
  run(raw: unknown, ctx: JobContext): Promise<unknown>;
}

/**
 * The typed contract each job class implements: parse/validate the raw payload
 * into its declared shape, then handle it. `J` ties `validate`'s output to
 * `handle`'s input at compile time.
 */
export interface JobHandler<J extends JobName = JobName> extends JobRunner {
  readonly job: J;
  validate(raw: unknown): JobPayloads[J];
  handle(data: JobPayloads[J], ctx: JobContext): Promise<unknown>;
}
