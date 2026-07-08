import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Feeds & Discovery (E6) — supporting indexes only (no new tables; feeds reuse
 * existing entities and cache in Redis, per the epic brief).
 *
 * - `idx_pieces_author_published` backs the **Following** feed: pieces from a set
 *   of followed authors, newest-published first (partial — published + live rows
 *   only). The existing `idx_pieces_latest` already backs Latest/Discover/Trending
 *   base scans; `idx_pieces_language`/`idx_pieces_genre` back filtered browse.
 * - `idx_piece_stats_claps` / `idx_piece_stats_comments` back the **most-clapped**
 *   and **most-discussed** keyset sorts (sort column + `piece_id` tiebreaker).
 */
export class FeedIndexes1783450000000 implements MigrationInterface {
  name = 'FeedIndexes1783450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "idx_pieces_author_published" ON "pieces" ("author_id", "published_at" DESC) WHERE status = 'published' AND deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_piece_stats_claps" ON "piece_stats" ("claps_count" DESC, "piece_id" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_piece_stats_comments" ON "piece_stats" ("comments_count" DESC, "piece_id" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_piece_stats_comments"`);
    await queryRunner.query(`DROP INDEX "public"."idx_piece_stats_claps"`);
    await queryRunner.query(`DROP INDEX "public"."idx_pieces_author_published"`);
  }
}
