import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Feeds & Discovery (E6) — supporting indexes only (no new tables; feeds reuse
 * existing entities and cache in Redis, per the epic brief).
 *
 * Scaffolded with the TypeORM CLI (`pnpm --filter backend migration:create`) so
 * the timestamp is a real `Date.now()` prefix (docs 04 §1.6). The DDL is authored
 * by hand because `migration:generate` is unusable in this codebase: entities use
 * plain FK columns with NO relations (docs 16 §3.1), so generate would try to
 * drop every foreign key. Index-only + partial/`DESC` indexes also can't be
 * expressed via entity decorators, so this is a legitimate hand-authored DDL
 * migration on a CLI-generated skeleton.
 *
 * - `idx_pieces_author_published` backs the Following feed (pieces from a set of
 *   followed authors, newest-published first — partial: live published rows only).
 * - `idx_piece_stats_claps` / `idx_piece_stats_comments` back the most-clapped /
 *   most-discussed keyset sorts (sort column + `piece_id` tiebreaker).
 */
export class FeedIndexes1783497129625 implements MigrationInterface {
  name = 'FeedIndexes1783497129625';

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
