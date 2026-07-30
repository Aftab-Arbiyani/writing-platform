import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Social Engagement (E7 — social & curation): `piece_stats`, `comments`,
 * `likes`, `claps`, `bookmarks`, `collections`, `collection_pieces`,
 * `responses`, `shares`. Hand-written (additive only), mirroring docs 04
 * §3.2/§3.4/§3.5/§3.14 + §10 (ON DELETE rules).
 *
 * Net-new beyond docs 04: the `comments` table (+ `piece_stats.comments_count`)
 * and `collections.is_default` (the auto-created "Favorites" collection). Both
 * additions are recorded in docs/04 and docs/00 in this same change (no ADR
 * drift). The `visibility` enum already exists (E3); only `share_channel` is new.
 */
export class SocialEngagement1783440000000 implements MigrationInterface {
  name = 'SocialEngagement1783440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── piece_stats (1:1 satellite, PK = piece_id) ───────────────────────────
    await queryRunner.query(
      `CREATE TABLE "piece_stats" (
        "piece_id" uuid NOT NULL,
        "views_count" bigint NOT NULL DEFAULT 0,
        "reads_count" bigint NOT NULL DEFAULT 0,
        "likes_count" integer NOT NULL DEFAULT 0,
        "claps_count" integer NOT NULL DEFAULT 0,
        "bookmarks_count" integer NOT NULL DEFAULT 0,
        "comments_count" integer NOT NULL DEFAULT 0,
        "responses_count" integer NOT NULL DEFAULT 0,
        "shares_count" integer NOT NULL DEFAULT 0,
        "reposts_count" integer NOT NULL DEFAULT 0,
        "trending_score" double precision NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_piece_stats" PRIMARY KEY ("piece_id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_piece_stats_trending" ON "piece_stats" ("trending_score")`,
    );

    // ── comments (net-new; soft-deletable; self-referential replies) ─────────
    await queryRunner.query(
      `CREATE TABLE "comments" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "piece_id" uuid NOT NULL,
        "author_id" uuid NOT NULL,
        "parent_id" uuid,
        "depth" smallint NOT NULL DEFAULT 1,
        "body" text NOT NULL,
        "edited_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_comments" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_comments_piece" ON "comments" ("piece_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_comments_parent" ON "comments" ("parent_id", "created_at")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_comments_author" ON "comments" ("author_id")`);

    // ── likes (append-only, one per user per piece) ──────────────────────────
    await queryRunner.query(
      `CREATE TABLE "likes" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "piece_id" uuid NOT NULL,
        CONSTRAINT "PK_likes" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_likes_user_piece" ON "likes" ("user_id", "piece_id")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_likes_piece" ON "likes" ("piece_id", "created_at")`);

    // ── claps (upserted running count, capped 1..50) ─────────────────────────
    await queryRunner.query(
      `CREATE TABLE "claps" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "piece_id" uuid NOT NULL,
        "count" smallint NOT NULL DEFAULT 1,
        CONSTRAINT "chk_claps_count_range" CHECK ("count" BETWEEN 1 AND 50),
        CONSTRAINT "PK_claps" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_claps_user_piece" ON "claps" ("user_id", "piece_id")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_claps_piece" ON "claps" ("piece_id", "created_at")`);

    // ── bookmarks (append-only, private) ─────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "bookmarks" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "piece_id" uuid NOT NULL,
        CONSTRAINT "PK_bookmarks" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_bookmarks_user_piece" ON "bookmarks" ("user_id", "piece_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_bookmarks_user" ON "bookmarks" ("user_id", "created_at")`,
    );

    // ── collections (soft-deletable; + is_default "Favorites") ───────────────
    await queryRunner.query(
      `CREATE TABLE "collections" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "owner_id" uuid NOT NULL,
        "title" character varying(150) NOT NULL,
        "slug" citext NOT NULL,
        "description" character varying(500),
        "cover_image_key" text,
        "visibility" "public"."visibility" NOT NULL DEFAULT 'private',
        "is_default" boolean NOT NULL DEFAULT false,
        "pieces_count" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_collections" PRIMARY KEY ("id")
      )`,
    );
    // Active-only unique slug per owner — soft-deleted collections free their slug.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_collections_owner_slug" ON "collections" ("owner_id", "slug") WHERE "deleted_at" IS NULL`,
    );
    // Exactly one active default ("Favorites") per owner.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_collections_default" ON "collections" ("owner_id") WHERE "is_default" = true AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collections_owner" ON "collections" ("owner_id", "created_at")`,
    );

    // ── collection_pieces (membership, carries position/note) ────────────────
    await queryRunner.query(
      `CREATE TABLE "collection_pieces" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "collection_id" uuid NOT NULL,
        "piece_id" uuid NOT NULL,
        "position" integer NOT NULL DEFAULT 0,
        "note" character varying(300),
        CONSTRAINT "PK_collection_pieces" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_collection_pieces" ON "collection_pieces" ("collection_id", "piece_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collection_pieces_pos" ON "collection_pieces" ("collection_id", "position")`,
    );

    // ── responses (piece → parent piece link) ────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "responses" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "piece_id" uuid NOT NULL,
        "parent_piece_id" uuid NOT NULL,
        CONSTRAINT "chk_responses_not_self" CHECK ("piece_id" <> "parent_piece_id"),
        CONSTRAINT "PK_responses" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_responses_piece" ON "responses" ("piece_id")`);
    await queryRunner.query(
      `CREATE INDEX "idx_responses_parent" ON "responses" ("parent_piece_id", "created_at")`,
    );

    // ── shares (append-only tracking; count only, no dashboard) ──────────────
    await queryRunner.query(
      `CREATE TYPE "public"."share_channel" AS ENUM('internal', 'external', 'copy_link')`,
    );
    await queryRunner.query(
      `CREATE TABLE "shares" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid,
        "piece_id" uuid NOT NULL,
        "channel" "public"."share_channel" NOT NULL,
        CONSTRAINT "PK_shares" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_shares_piece" ON "shares" ("piece_id", "created_at")`,
    );

    // ── foreign keys (docs 04 §10) ───────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "piece_stats" ADD CONSTRAINT "fk_piece_stats_piece" FOREIGN KEY ("piece_id") REFERENCES "pieces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "fk_comments_piece" FOREIGN KEY ("piece_id") REFERENCES "pieces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "fk_comments_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "fk_comments_parent" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "likes" ADD CONSTRAINT "fk_likes_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "likes" ADD CONSTRAINT "fk_likes_piece" FOREIGN KEY ("piece_id") REFERENCES "pieces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claps" ADD CONSTRAINT "fk_claps_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claps" ADD CONSTRAINT "fk_claps_piece" FOREIGN KEY ("piece_id") REFERENCES "pieces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookmarks" ADD CONSTRAINT "fk_bookmarks_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookmarks" ADD CONSTRAINT "fk_bookmarks_piece" FOREIGN KEY ("piece_id") REFERENCES "pieces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collections" ADD CONSTRAINT "fk_collections_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collection_pieces" ADD CONSTRAINT "fk_collection_pieces_collection" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collection_pieces" ADD CONSTRAINT "fk_collection_pieces_piece" FOREIGN KEY ("piece_id") REFERENCES "pieces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "responses" ADD CONSTRAINT "fk_responses_piece" FOREIGN KEY ("piece_id") REFERENCES "pieces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "responses" ADD CONSTRAINT "fk_responses_parent" FOREIGN KEY ("parent_piece_id") REFERENCES "pieces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shares" ADD CONSTRAINT "fk_shares_piece" FOREIGN KEY ("piece_id") REFERENCES "pieces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shares" ADD CONSTRAINT "fk_shares_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shares" DROP CONSTRAINT "fk_shares_user"`);
    await queryRunner.query(`ALTER TABLE "shares" DROP CONSTRAINT "fk_shares_piece"`);
    await queryRunner.query(`ALTER TABLE "responses" DROP CONSTRAINT "fk_responses_parent"`);
    await queryRunner.query(`ALTER TABLE "responses" DROP CONSTRAINT "fk_responses_piece"`);
    await queryRunner.query(
      `ALTER TABLE "collection_pieces" DROP CONSTRAINT "fk_collection_pieces_piece"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collection_pieces" DROP CONSTRAINT "fk_collection_pieces_collection"`,
    );
    await queryRunner.query(`ALTER TABLE "collections" DROP CONSTRAINT "fk_collections_owner"`);
    await queryRunner.query(`ALTER TABLE "bookmarks" DROP CONSTRAINT "fk_bookmarks_piece"`);
    await queryRunner.query(`ALTER TABLE "bookmarks" DROP CONSTRAINT "fk_bookmarks_user"`);
    await queryRunner.query(`ALTER TABLE "claps" DROP CONSTRAINT "fk_claps_piece"`);
    await queryRunner.query(`ALTER TABLE "claps" DROP CONSTRAINT "fk_claps_user"`);
    await queryRunner.query(`ALTER TABLE "likes" DROP CONSTRAINT "fk_likes_piece"`);
    await queryRunner.query(`ALTER TABLE "likes" DROP CONSTRAINT "fk_likes_user"`);
    await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "fk_comments_parent"`);
    await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "fk_comments_author"`);
    await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "fk_comments_piece"`);
    await queryRunner.query(`ALTER TABLE "piece_stats" DROP CONSTRAINT "fk_piece_stats_piece"`);

    await queryRunner.query(`DROP INDEX "public"."idx_shares_piece"`);
    await queryRunner.query(`DROP TABLE "shares"`);
    await queryRunner.query(`DROP TYPE "public"."share_channel"`);
    await queryRunner.query(`DROP INDEX "public"."idx_responses_parent"`);
    await queryRunner.query(`DROP INDEX "public"."uq_responses_piece"`);
    await queryRunner.query(`DROP TABLE "responses"`);
    await queryRunner.query(`DROP INDEX "public"."idx_collection_pieces_pos"`);
    await queryRunner.query(`DROP INDEX "public"."uq_collection_pieces"`);
    await queryRunner.query(`DROP TABLE "collection_pieces"`);
    await queryRunner.query(`DROP INDEX "public"."idx_collections_owner"`);
    await queryRunner.query(`DROP INDEX "public"."uq_collections_default"`);
    await queryRunner.query(`DROP INDEX "public"."uq_collections_owner_slug"`);
    await queryRunner.query(`DROP TABLE "collections"`);
    await queryRunner.query(`DROP INDEX "public"."idx_bookmarks_user"`);
    await queryRunner.query(`DROP INDEX "public"."uq_bookmarks_user_piece"`);
    await queryRunner.query(`DROP TABLE "bookmarks"`);
    await queryRunner.query(`DROP INDEX "public"."idx_claps_piece"`);
    await queryRunner.query(`DROP INDEX "public"."uq_claps_user_piece"`);
    await queryRunner.query(`DROP TABLE "claps"`);
    await queryRunner.query(`DROP INDEX "public"."idx_likes_piece"`);
    await queryRunner.query(`DROP INDEX "public"."uq_likes_user_piece"`);
    await queryRunner.query(`DROP TABLE "likes"`);
    await queryRunner.query(`DROP INDEX "public"."idx_comments_author"`);
    await queryRunner.query(`DROP INDEX "public"."idx_comments_parent"`);
    await queryRunner.query(`DROP INDEX "public"."idx_comments_piece"`);
    await queryRunner.query(`DROP TABLE "comments"`);
    await queryRunner.query(`DROP INDEX "public"."idx_piece_stats_trending"`);
    await queryRunner.query(`DROP TABLE "piece_stats"`);
  }
}
