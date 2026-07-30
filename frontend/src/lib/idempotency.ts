/**
 * Idempotency keys (docs/32 §8). `POST /pieces/:id/publish` accepts an `Idempotency-Key`
 * header: generate ONE key per user intent (per tap of "Publish"), not per HTTP attempt, so a
 * retry with the same key replays the stored response instead of double-publishing. Publish is
 * the only mutation TanStack Query may retry.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
