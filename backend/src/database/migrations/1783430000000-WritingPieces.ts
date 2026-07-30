import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Writing engine (E4): `tags`, `pieces`, `piece_tags`. Hand-written (additive
 * only) because `migration:generate` chokes on the E3 hand-added generated
 * `search_vector` column (it expects a `typeorm_metadata` table it never
 * populated). Mirrors docs 04 §3.2/§3.3 exactly, plus the E4 additions
 * (`archived_at`, `seo_metadata`). `visibility` enum + `immutable_unaccent`
 * already exist from E3.
 */
export class WritingPieces1783430000000 implements MigrationInterface {
  name = 'WritingPieces1783430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── tags (user-created via #hashtags) ────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "tags" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "slug" citext NOT NULL, "name" character varying(60) NOT NULL, "pieces_count" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_tags" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_tags_slug" ON "tags" ("slug")`);
    await queryRunner.query(
      `CREATE INDEX "idx_tags_name_trgm" ON "tags" USING GIN ("name" gin_trgm_ops)`,
    );

    // ── pieces ────────────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TYPE "public"."piece_status" AS ENUM('draft', 'scheduled', 'published', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TABLE "pieces" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "author_id" uuid NOT NULL,
        "title" character varying(200) NOT NULL DEFAULT '',
        "subtitle" character varying(300),
        "slug" citext,
        "content" jsonb NOT NULL,
        "content_text" text NOT NULL DEFAULT '',
        "featured_quote" character varying(500),
        "cover_image_key" text,
        "language_id" uuid NOT NULL,
        "genre_id" uuid,
        "status" "public"."piece_status" NOT NULL DEFAULT 'draft',
        "visibility" "public"."visibility" NOT NULL DEFAULT 'public',
        "scheduled_at" TIMESTAMP WITH TIME ZONE,
        "published_at" TIMESTAMP WITH TIME ZONE,
        "archived_at" TIMESTAMP WITH TIME ZONE,
        "word_count" integer NOT NULL DEFAULT 0,
        "reading_time_seconds" integer NOT NULL DEFAULT 0,
        "seo_metadata" jsonb,
        CONSTRAINT "chk_pieces_scheduled" CHECK (status <> 'scheduled' OR scheduled_at IS NOT NULL),
        CONSTRAINT "chk_pieces_published" CHECK (status <> 'published' OR (slug IS NOT NULL AND published_at IS NOT NULL AND genre_id IS NOT NULL)),
        CONSTRAINT "PK_pieces" PRIMARY KEY ("id")
      )`,
    );

    // Generated FTS vector (docs 04 §6.2) — reuses the E3 immutable_unaccent wrapper.
    await queryRunner.query(
      `ALTER TABLE "pieces" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', immutable_unaccent(coalesce("title", ''))), 'A') ||
        setweight(to_tsvector('simple', immutable_unaccent(coalesce("subtitle", ''))), 'B') ||
        setweight(to_tsvector('simple', immutable_unaccent(coalesce("content_text", ''))), 'C')
      ) STORED`,
    );

    await queryRunner.query(`CREATE UNIQUE INDEX "uq_pieces_slug" ON "pieces" ("slug")`);
    await queryRunner.query(
      `CREATE INDEX "idx_pieces_author_status" ON "pieces" ("author_id", "status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pieces_language" ON "pieces" ("language_id", "published_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pieces_genre" ON "pieces" ("genre_id", "published_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pieces_latest" ON "pieces" ("published_at" DESC, "id" DESC) WHERE status = 'published' AND visibility = 'public' AND deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pieces_due" ON "pieces" ("scheduled_at") WHERE status = 'scheduled'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pieces_search" ON "pieces" USING GIN ("search_vector")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pieces_title_trgm" ON "pieces" USING GIN ("title" gin_trgm_ops)`,
    );

    // ── piece_tags (M:N join) ────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "piece_tags" ("piece_id" uuid NOT NULL, "tag_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_piece_tags" PRIMARY KEY ("piece_id", "tag_id"))`,
    );
    await queryRunner.query(`CREATE INDEX "idx_piece_tags_tag" ON "piece_tags" ("tag_id")`);

    // ── foreign keys (docs 04 §3.2/§10) ──────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "pieces" ADD CONSTRAINT "fk_pieces_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pieces" ADD CONSTRAINT "fk_pieces_language" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pieces" ADD CONSTRAINT "fk_pieces_genre" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "piece_tags" ADD CONSTRAINT "fk_piece_tags_piece" FOREIGN KEY ("piece_id") REFERENCES "pieces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "piece_tags" ADD CONSTRAINT "fk_piece_tags_tag" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "piece_tags" DROP CONSTRAINT "fk_piece_tags_tag"`);
    await queryRunner.query(`ALTER TABLE "piece_tags" DROP CONSTRAINT "fk_piece_tags_piece"`);
    await queryRunner.query(`ALTER TABLE "pieces" DROP CONSTRAINT "fk_pieces_genre"`);
    await queryRunner.query(`ALTER TABLE "pieces" DROP CONSTRAINT "fk_pieces_language"`);
    await queryRunner.query(`ALTER TABLE "pieces" DROP CONSTRAINT "fk_pieces_author"`);
    await queryRunner.query(`DROP INDEX "public"."idx_piece_tags_tag"`);
    await queryRunner.query(`DROP TABLE "piece_tags"`);
    await queryRunner.query(`DROP INDEX "public"."idx_pieces_title_trgm"`);
    await queryRunner.query(`DROP INDEX "public"."idx_pieces_search"`);
    await queryRunner.query(`DROP INDEX "public"."idx_pieces_due"`);
    await queryRunner.query(`DROP INDEX "public"."idx_pieces_latest"`);
    await queryRunner.query(`DROP INDEX "public"."idx_pieces_genre"`);
    await queryRunner.query(`DROP INDEX "public"."idx_pieces_language"`);
    await queryRunner.query(`DROP INDEX "public"."idx_pieces_author_status"`);
    await queryRunner.query(`DROP INDEX "public"."uq_pieces_slug"`);
    await queryRunner.query(`DROP TABLE "pieces"`);
    await queryRunner.query(`DROP TYPE "public"."piece_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_tags_name_trgm"`);
    await queryRunner.query(`DROP INDEX "public"."uq_tags_slug"`);
    await queryRunner.query(`DROP TABLE "tags"`);
  }
}
