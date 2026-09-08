import { Job } from 'bullmq';

import { assertValidJobId, jobId } from './job-id';
import { JOB } from './queue.constants';

/**
 * Drives BullMQ's own validator with a stand-in `this` — no Redis, no connection.
 * `Job.prototype.validateOptions` reads only `this.opts`, `this.name` and
 * `jobData.data`, which is what makes this safe to call directly. It is the
 * method that threw `Custom Id cannot contain :` in production while every mocked
 * producer spec stayed green.
 */
function bullmqRejects(id: string): boolean {
  // `validateOptions` is protected, so reach it through the prototype rather than
  // the class — this is a probe of a third-party internal, deliberately isolated
  // in this one function so the cast never spreads into the assertions below.
  const { validateOptions: validate } = Job.prototype as unknown as {
    validateOptions: (this: unknown, jobData: unknown) => void;
  };
  try {
    validate.call({ opts: { jobId: id }, name: 'probe' }, { data: '' });
    return false;
  } catch {
    return true;
  }
}

describe('jobId', () => {
  it('joins parts with a separator BullMQ accepts', () => {
    const id = jobId(JOB.PublishOne, '0192f3aa-1111-7000-8000-000000000000');
    expect(id).toBe('publish-one-0192f3aa-1111-7000-8000-000000000000');
    expect(bullmqRejects(id)).toBe(false);
  });

  it('accepts a single part', () => {
    expect(jobId('discovery')).toBe('discovery');
  });

  it('refuses to build an id from a part containing ":"', () => {
    expect(() => jobId('publish', 'a:b')).toThrow(/reserved as the Redis key separator/);
  });

  it('requires at least one non-empty part', () => {
    expect(() => jobId()).toThrow(/at least one non-empty part/);
    expect(() => jobId('')).toThrow(/at least one non-empty part/);
  });
});

describe('assertValidJobId', () => {
  it.each(['publish:abc', 'cache-invalidate:discovery', 'a:b:c:d'])('rejects %s', (id) => {
    expect(() => assertValidJobId(id)).toThrow(/reserved as the Redis key separator/);
  });

  it('rejects a plain integer', () => {
    expect(() => assertValidJobId('42')).toThrow(/may not be a plain integer/);
  });

  it('accepts an id that merely starts with digits', () => {
    expect(() => assertValidJobId('42-pieces')).not.toThrow();
  });

  /**
   * The whole point of the helper: our rule must be at least as strict as the one
   * BullMQ enforces at enqueue time, or a bad id passes here and throws in prod —
   * which is exactly what happened. Differential, so a version bump that tightens
   * BullMQ's check fails here instead of in production.
   */
  it.each([
    ['publish:abc', true],
    ['cache-invalidate:discovery', true],
    ['42', true],
    ['publish-one-abc', false],
    ['cache-invalidate-discovery', false],
    ['42-pieces', false],
  ])('is at least as strict as BullMQ for %s', (id, bullmqShouldReject) => {
    expect(bullmqRejects(id)).toBe(bullmqShouldReject);
    if (bullmqShouldReject) {
      expect(() => assertValidJobId(id)).toThrow();
    }
  });

  /**
   * The one case where we are deliberately STRICTER than BullMQ 5.79.2: a
   * two-colon id passes its `split(':').length !== 3` back-compat escape hatch,
   * but its source carries `TODO: replace this check in next breaking check with
   * include(':')`. We reject it now so no such id can be written and then break
   * on an upgrade. If this test starts failing because BullMQ began rejecting it
   * too, delete the test — the divergence closed on its own.
   */
  it('rejects the legacy three-part form BullMQ still tolerates', () => {
    expect(bullmqRejects('a:b:c')).toBe(false);
    expect(() => assertValidJobId('a:b:c')).toThrow();
  });
});
