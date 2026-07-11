import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Content Moderation module — four new, purely additive tables: `reports`,
 * `report_notes`, `appeals`, `user_warnings`. Nothing existing is altered
 * (moderation reuses `audit_logs` for history and existing content lifecycle for
 * take-down), so this is non-breaking: no column changes, no backfill, no locks
 * on populated tables.
 *
 * Scaffolded with `pnpm --filter backend migration:create` (real Date.now()
 * prefix, docs 04 §1.6); DDL hand-authored to match the entities. Enum-ish
 * columns are `varchar` (validated by DTOs) — no native PG enum types. Reporter /
 * target / actor columns are plain uuids with NO foreign key: moderation records
 * are evidence and must survive a hard-deleted target (cf. `audit_logs`).
 */
export class Moderation1783748430237 implements MigrationInterface {
  name = 'Moderation1783748430237';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "reports" (
        "id" uuid NOT NULL,
        "reporter_id" uuid NOT NULL,
        "entity_type" character varying(20) NOT NULL,
        "entity_id" uuid NOT NULL,
        "reported_user_id" uuid,
        "reason" character varying(30) NOT NULL,
        "description" text,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "priority" character varying(20) NOT NULL DEFAULT 'normal',
        "severity" character varying(20),
        "assigned_moderator_id" uuid,
        "resolution" character varying(30),
        "resolution_reason" text,
        "resolved_by_id" uuid,
        "resolved_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reports" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reports_status_priority" ON "reports" ("status", "priority", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reports_entity" ON "reports" ("entity_type", "entity_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reports_reported_user" ON "reports" ("reported_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reports_assignee" ON "reports" ("assigned_moderator_id")`,
    );

    await queryRunner.query(
      `CREATE TABLE "report_notes" (
        "id" uuid NOT NULL,
        "report_id" uuid NOT NULL,
        "author_id" uuid NOT NULL,
        "body" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_notes" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_report_notes_report" ON "report_notes" ("report_id", "created_at")`,
    );

    await queryRunner.query(
      `CREATE TABLE "appeals" (
        "id" uuid NOT NULL,
        "report_id" uuid NOT NULL,
        "appellant_id" uuid NOT NULL,
        "reason" text NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "reviewed_by_id" uuid,
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        "review_notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_appeals" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_appeals_report" ON "appeals" ("report_id")`);
    await queryRunner.query(
      `CREATE INDEX "idx_appeals_status" ON "appeals" ("status", "created_at")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_appeals_appellant" ON "appeals" ("appellant_id")`);

    await queryRunner.query(
      `CREATE TABLE "user_warnings" (
        "id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "moderator_id" uuid NOT NULL,
        "report_id" uuid,
        "reason" text NOT NULL,
        "severity" character varying(20) NOT NULL DEFAULT 'low',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_warnings" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_warnings_user" ON "user_warnings" ("user_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_user_warnings_user"`);
    await queryRunner.query(`DROP TABLE "user_warnings"`);
    await queryRunner.query(`DROP INDEX "public"."idx_appeals_appellant"`);
    await queryRunner.query(`DROP INDEX "public"."idx_appeals_status"`);
    await queryRunner.query(`DROP INDEX "public"."uq_appeals_report"`);
    await queryRunner.query(`DROP TABLE "appeals"`);
    await queryRunner.query(`DROP INDEX "public"."idx_report_notes_report"`);
    await queryRunner.query(`DROP TABLE "report_notes"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reports_assignee"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reports_reported_user"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reports_entity"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reports_status_priority"`);
    await queryRunner.query(`DROP TABLE "reports"`);
  }
}
