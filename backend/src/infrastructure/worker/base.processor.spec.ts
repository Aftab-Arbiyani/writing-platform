import { Logger } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import type { Job } from 'bullmq';

import type { JobContext, JobRunner } from '../../common/queue/job-handler';
import { JOB, QUEUE } from '../../common/queue/queue.constants';
import { BaseProcessor } from './base.processor';

/** Concrete processor wired with a single fake runner for the queue. */
class TestProcessor extends BaseProcessor {
  protected readonly queueName = QUEUE.Maintenance;
  constructor(runner: JobRunner) {
    super([runner]);
  }
}

function fakeRunner(run: (raw: unknown, ctx: JobContext) => Promise<unknown>): JobRunner {
  return { job: JOB.DailyCleanup, run };
}

function makeJob(overrides: Partial<Job> & { data?: unknown; name?: string } = {}): Job {
  return {
    id: 'j1',
    name: JOB.DailyCleanup,
    data: { meta: { requestId: 'req-1' }, foo: 'bar' },
    opts: { attempts: 3 },
    attemptsMade: 0,
    ...overrides,
  } as unknown as Job;
}

describe('BaseProcessor (dispatcher)', () => {
  it('dispatches to the runner, stripping the meta envelope, and returns its result', async () => {
    const run = jest.fn().mockResolvedValue({ ok: true });
    const proc = new TestProcessor(fakeRunner(run));
    const result = await proc.process(makeJob());
    expect(result).toEqual({ ok: true });
    // The runner receives the payload WITHOUT `meta`.
    expect(run).toHaveBeenCalledWith(
      { foo: 'bar' },
      expect.objectContaining({ requestId: 'req-1' }),
    );
  });

  it('dead-letters (UnrecoverableError) when no handler is registered for the job name', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const proc = new TestProcessor(fakeRunner(jest.fn()));
    await expect(proc.process(makeJob({ name: 'unknown-job' }))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(error).toHaveBeenCalledWith(expect.stringContaining('job.dead_lettered'));
  });

  it('logs job.failed (warn) and rethrows on a non-final attempt', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const proc = new TestProcessor(fakeRunner(jest.fn().mockRejectedValue(new Error('boom'))));
    await expect(proc.process(makeJob({ attemptsMade: 0 }))).rejects.toThrow('boom');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('job.failed'));
    expect(error).not.toHaveBeenCalled();
  });

  it('logs job.dead_lettered (error) on the final attempt', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const proc = new TestProcessor(fakeRunner(jest.fn().mockRejectedValue(new Error('boom'))));
    await expect(proc.process(makeJob({ attemptsMade: 2 }))).rejects.toThrow('boom');
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('job.dead_lettered'),
      expect.anything(),
    );
  });

  it('dead-letters immediately when the runner throws UnrecoverableError (bad payload)', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const proc = new TestProcessor(
      fakeRunner(jest.fn().mockRejectedValue(new UnrecoverableError('invalid payload'))),
    );
    // attemptsMade 0 but still dead-lettered (not retried).
    await expect(proc.process(makeJob({ attemptsMade: 0 }))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('job.dead_lettered'),
      expect.anything(),
    );
  });
});
