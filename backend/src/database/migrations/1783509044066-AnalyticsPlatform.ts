import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Analytics & Insights Platform (E10) — seven NEW analytics-owned tables. Purely
 * additive; no existing table is touched (analytics reads other domains' tables
 * read-only via the DataSource, and is fed by domain events). MVP design (per the
 * epic's improvement): aggregates are the source for the APIs; raw events are kept
 * only for view/read dedup + trending signal. The partitioned `analytics_events`
 * firehose + rollup job (docs 04 §3.9) is the deferred data-warehouse scale path.
 *
 * Scaffolded with `pnpm --filter backend migration:create` (real Date.now());
 * DDL hand-authored (plain-FK entities, docs 16 §3.1). Analytics event tables
 * carry NO FKs (ingest hot path, docs 04 §3.9).
 *
 * - `piece_analytics`/`writer_analytics`/`reader_analytics` — satellite aggregates
 *   (PK = subject id), upserted by the listener.
 * - `platform_analytics` — singleton materialized counters (`id='global'`), seeded.
 * - `analytics_snapshot` — point-in-time metric snapshots for growth trends.
 * - `view_event` — one row per unique (piece, viewer) for unique-view detection
 *   + recent-view trending signal.
 * - `read_event` — one row per read session for read/completion + reader analytics.
 */
export class AnalyticsPlatform1783509044066 implements MigrationInterface {
  name = 'AnalyticsPlatform1783509044066';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── piece_analytics ──────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "piece_analytics" (
        "piece_id" uuid NOT NULL,
        "author_id" uuid NOT NULL,
        "views" bigint NOT NULL DEFAULT 0,
        "unique_views" bigint NOT NULL DEFAULT 0,
        "reads" bigint NOT NULL DEFAULT 0,
        "total_read_seconds" bigint NOT NULL DEFAULT 0,
        "completed_reads" bigint NOT NULL DEFAULT 0,
        "shares_internal" integer NOT NULL DEFAULT 0,
        "shares_external" integer NOT NULL DEFAULT 0,
        "shares_copy_link" integer NOT NULL DEFAULT 0,
        "published_at" TIMESTAMP WITH TIME ZONE,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_piece_analytics" PRIMARY KEY ("piece_id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_piece_analytics_author" ON "piece_analytics" ("author_id")`,
    );

    // ── writer_analytics ─────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "writer_analytics" (
        "user_id" uuid NOT NULL,
        "views" bigint NOT NULL DEFAULT 0,
        "unique_views" bigint NOT NULL DEFAULT 0,
        "reads" bigint NOT NULL DEFAULT 0,
        "total_read_seconds" bigint NOT NULL DEFAULT 0,
        "completed_reads" bigint NOT NULL DEFAULT 0,
        "followers_gained" integer NOT NULL DEFAULT 0,
        "pieces_published" integer NOT NULL DEFAULT 0,
        "pieces_archived" integer NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_writer_analytics" PRIMARY KEY ("user_id")
      )`,
    );

    // ── reader_analytics ─────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "reader_analytics" (
        "user_id" uuid NOT NULL,
        "pieces_read" bigint NOT NULL DEFAULT 0,
        "reads" bigint NOT NULL DEFAULT 0,
        "total_read_seconds" bigint NOT NULL DEFAULT 0,
        "completed_reads" bigint NOT NULL DEFAULT 0,
        "last_read_on" date,
        "current_streak" integer NOT NULL DEFAULT 0,
        "longest_streak" integer NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reader_analytics" PRIMARY KEY ("user_id")
      )`,
    );

    // ── platform_analytics (singleton, seeded) ───────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "platform_analytics" (
        "id" character varying(20) NOT NULL,
        "views" bigint NOT NULL DEFAULT 0,
        "unique_views" bigint NOT NULL DEFAULT 0,
        "reads" bigint NOT NULL DEFAULT 0,
        "completed_reads" bigint NOT NULL DEFAULT 0,
        "published_pieces" bigint NOT NULL DEFAULT 0,
        "archived_pieces" bigint NOT NULL DEFAULT 0,
        "comments" bigint NOT NULL DEFAULT 0,
        "claps" bigint NOT NULL DEFAULT 0,
        "bookmarks" bigint NOT NULL DEFAULT 0,
        "responses" bigint NOT NULL DEFAULT 0,
        "shares" bigint NOT NULL DEFAULT 0,
        "follows" bigint NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_analytics" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(`INSERT INTO "platform_analytics" ("id") VALUES ('global')`);

    // ── analytics_snapshot ───────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "analytics_snapshot" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "scope" character varying(20) NOT NULL,
        "subject_id" character varying(64) NOT NULL,
        "period" character varying(10) NOT NULL,
        "period_start" date NOT NULL,
        "metrics" jsonb NOT NULL DEFAULT '{}',
        CONSTRAINT "PK_analytics_snapshot" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_analytics_snapshot" ON "analytics_snapshot" ("scope", "subject_id", "period", "period_start")`,
    );

    // ── view_event ───────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "view_event" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "piece_id" uuid NOT NULL,
        "viewer_key" character varying(80) NOT NULL,
        "viewer_id" uuid,
        "is_authenticated" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_view_event" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_view_event_piece_viewer" ON "view_event" ("piece_id", "viewer_key")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_view_event_recent" ON "view_event" ("created_at")`);
    await queryRunner.query(`CREATE INDEX "idx_view_event_piece" ON "view_event" ("piece_id")`);

    // ── read_event ───────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "read_event" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "piece_id" uuid NOT NULL,
        "reader_id" uuid,
        "duration_seconds" integer NOT NULL DEFAULT 0,
        "completion_pct" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_read_event" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_read_event_reader_piece" ON "read_event" ("reader_id", "piece_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_read_event_reader" ON "read_event" ("reader_id", "created_at")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_read_event_piece" ON "read_event" ("piece_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "read_event"`);
    await queryRunner.query(`DROP TABLE "view_event"`);
    await queryRunner.query(`DROP INDEX "public"."uq_analytics_snapshot"`);
    await queryRunner.query(`DROP TABLE "analytics_snapshot"`);
    await queryRunner.query(`DROP TABLE "platform_analytics"`);
    await queryRunner.query(`DROP TABLE "reader_analytics"`);
    await queryRunner.query(`DROP TABLE "writer_analytics"`);
    await queryRunner.query(`DROP INDEX "public"."idx_piece_analytics_author"`);
    await queryRunner.query(`DROP TABLE "piece_analytics"`);
  }
}
