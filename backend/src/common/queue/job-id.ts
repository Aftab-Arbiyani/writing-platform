/**
 * The one sanctioned way to build a custom BullMQ job id.
 *
 * BullMQ reserves `:` as its Redis key separator and validates custom ids when a
 * job is added — a violation throws `Custom Id cannot contain :` at enqueue time,
 * not at startup. Two ids in this codebase were built with `:` and therefore
 * NEVER enqueued (scheduled publishing threw; discovery cache invalidation failed
 * silently behind the event bus's handler catch). Neither was caught by a unit
 * test, because every producer spec mocks `Queue.add` — so BullMQ's validator has
 * no chance to run. That is why the rule lives here and is asserted by
 * {@link QueueProducer.buildJobOptions}: the constraint now fails in the specs
 * that already exist, with no Redis involved.
 *
 * The two rules, both from bullmq's `Job.validateOptions` (5.79.2):
 *
 * - **No `:`.** Today's check is `includes(':') && split(':').length !== 3`, so a
 *   two-colon id sneaks through for backwards compatibility with old repeatable
 *   jobs — but the source carries a `TODO: replace this check in next breaking
 *   check with include(':')`. Anything with a colon is living on borrowed time;
 *   we allow none.
 * - **Not a plain integer.** `'42'` throws `Custom Id cannot be integers`, because
 *   BullMQ's own auto-generated ids are integers and a custom one would collide.
 *
 * Parts are joined with `-`. The id only has to be stable and unique — nothing
 * reads it back or parses it — so a part that itself contains `-` (a uuid, say)
 * is fine.
 *
 * ```ts
 * jobId(JOB.PublishOne, pieceId); // 'publish-one-0192f3…'
 * ```
 */
export function jobId(...parts: readonly string[]): string {
  const id = parts.join('-');
  if (parts.length === 0 || id.length === 0) {
    throw new Error('jobId() requires at least one non-empty part');
  }
  assertValidJobId(id);
  return id;
}

/**
 * Throws if `id` would be rejected by BullMQ at enqueue time. Exported so the
 * producer can guard ids built anywhere, including ones that never went through
 * {@link jobId}.
 */
export function assertValidJobId(id: string): void {
  if (id.includes(':')) {
    throw new Error(
      `Invalid BullMQ job id "${id}": ':' is reserved as the Redis key separator. Build ids with jobId() from common/queue/job-id.`,
    );
  }
  if (`${Number.parseInt(id, 10)}` === id) {
    throw new Error(
      `Invalid BullMQ job id "${id}": a custom id may not be a plain integer (it would collide with BullMQ's own ids).`,
    );
  }
}
