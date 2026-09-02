import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * D5 — search became a public surface, so a retrieval request no longer always has a user.
 * `retrieval_query_logs.user_id` becomes nullable; an anonymous search records its shape
 * (intent, sources, latencies, confidence) with no owner. Nothing else about the table
 * changes: the query text was never stored, and the `(user_id, created_at)` index is happy
 * with nulls.
 *
 * Reversible with a caveat that cannot be engineered away: `down()` restores `NOT NULL`,
 * which FAILS while anonymous rows exist. Reverting therefore requires deciding what those
 * rows are worth first — `DELETE FROM retrieval_query_logs WHERE user_id IS NULL` discards
 * them, which is the only honest option since there is no owner to attribute them to. The
 * table is append-only internal telemetry, never user-visible, so that loss is analytics
 * history rather than product data.
 *
 * Generated with `pnpm migration:generate` (never hand-authored, never a made-up timestamp).
 * The generator again emitted the large block of PRE-EXISTING drift between entity metadata
 * and the hand-tuned SQL of earlier migrations — dropping every FK, both `search_vector`
 * generated columns, and the trigram/partial indexes — plus a `sources` jsonb-default recast
 * and an index column-order flip. None of it belongs to D5 and applying it would be
 * destructive, so the body is reduced to the one intended change. That drift is real, is
 * unchanged since the B5 migration recorded it (`1786181711060-UserAiPreference`), and is
 * still worth its own row; it is not this migration's to carry.
 */
export class RetrievalAnonymousTelemetry1788347842525 implements MigrationInterface {
  name = 'RetrievalAnonymousTelemetry1788347842525';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "retrieval_query_logs" ALTER COLUMN "user_id" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "retrieval_query_logs" ALTER COLUMN "user_id" SET NOT NULL`,
    );
  }
}
