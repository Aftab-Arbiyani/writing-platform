import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Search & Discovery (E8) — two NEW tables plus supporting indexes. Everything
 * else the search engine reads (pieces/profiles/tags/genres/languages) already
 * exists, and the FTS assets it queries — the generated `pieces.search_vector`
 * and `profiles.search_vector` tsvector columns, their `idx_*_search` GIN
 * indexes, and the `*_trgm` trigram indexes plus the `immutable_unaccent`
 * wrapper and the `unaccent`/`pg_trgm` extensions — were all created in E1/E3/E4
 * (docs 04 §6). This migration therefore adds only what search OWNS.
 *
 * Scaffolded with the TypeORM CLI (`pnpm --filter backend migration:create`) so
 * the timestamp is a real `Date.now()` prefix (docs 04 §1.6). The DDL is
 * hand-authored because `migration:generate` is unusable here — entities use
 * plain FK columns with no relations (docs 16 §3.1), so generate would try to
 * drop every foreign key.
 *
 * Tables:
 * - `recent_searches` — a signed-in user's history (max 20, trimmed by the
 *   service). `uq_recent_searches_user_query` de-duplicates a term per user;
 *   `idx_recent_searches_user_recent` backs the newest-first listing. FK to
 *   users ON DELETE CASCADE (history dies with the account).
 * - `search_keywords` — global per-term popularity for trending. Unique keyword
 *   (upsert target); `idx_search_keywords_popularity` backs the top-N read.
 *
 * Indexes on existing tables:
 * - `idx_tags_pieces_count` — backs autocomplete tag ranking by usage (docs 04
 *   §3.11 names `pieces_count` for "autocomplete rank"). Tag SEARCH/trending
 *   instead aggregate the live public-piece count (the denormalized counter is
 *   not yet maintained by the writing engine and would over-count non-public
 *   pieces); this index stays for autocomplete + the future maintained counter.
 * - `idx_pieces_featured_quote_trgm` — the generated `pieces.search_vector`
 *   deliberately excludes `featured_quote` (docs 04 §6.2), but the brief requires
 *   searching it; a trigram GIN keeps that OR-branch index-accelerated so piece
 *   search stays within the p95 budget (docs 18 E8 acceptance).
 */
export class SearchEngine1783498778024 implements MigrationInterface {
  name = 'SearchEngine1783498778024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── recent_searches ──────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "recent_searches" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "query" character varying(256) NOT NULL,
        "search_type" character varying(20) NOT NULL DEFAULT 'all',
        CONSTRAINT "PK_recent_searches" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_recent_searches_user_query" ON "recent_searches" ("user_id", "query")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_recent_searches_user_recent" ON "recent_searches" ("user_id", "updated_at" DESC)`,
    );
    await queryRunner.query(
      `ALTER TABLE "recent_searches" ADD CONSTRAINT "fk_recent_searches_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // ── search_keywords ──────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "search_keywords" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "keyword" character varying(256) NOT NULL,
        "search_count" integer NOT NULL DEFAULT 0,
        "last_searched_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_search_keywords" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_search_keywords_keyword" ON "search_keywords" ("keyword")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_search_keywords_popularity" ON "search_keywords" ("search_count" DESC, "last_searched_at" DESC)`,
    );

    // ── supporting indexes on existing tables ────────────────────────────────
    await queryRunner.query(`CREATE INDEX "idx_tags_pieces_count" ON "tags" ("pieces_count" DESC)`);
    await queryRunner.query(
      `CREATE INDEX "idx_pieces_featured_quote_trgm" ON "pieces" USING GIN ("featured_quote" gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_pieces_featured_quote_trgm"`);
    await queryRunner.query(`DROP INDEX "public"."idx_tags_pieces_count"`);

    await queryRunner.query(`DROP INDEX "public"."idx_search_keywords_popularity"`);
    await queryRunner.query(`DROP INDEX "public"."uq_search_keywords_keyword"`);
    await queryRunner.query(`DROP TABLE "search_keywords"`);

    await queryRunner.query(
      `ALTER TABLE "recent_searches" DROP CONSTRAINT "fk_recent_searches_user"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_recent_searches_user_recent"`);
    await queryRunner.query(`DROP INDEX "public"."uq_recent_searches_user_query"`);
    await queryRunner.query(`DROP TABLE "recent_searches"`);
  }
}
