import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Admin audit trail (E12.5) — ONE new, purely additive table `audit_logs`.
 * Nothing existing is altered, so this is a non-breaking migration: no column
 * changes, no data backfill, no locks on populated tables.
 *
 * Scaffolded with `pnpm --filter backend migration:create` (real Date.now()
 * prefix, docs 04 §1.6); DDL hand-authored (append-only entity, docs 16 §3.1).
 *
 * Design (matches `modules/audit/entities/audit-log.entity.ts`):
 * - append-only: `created_at` only, no `updated_at`/`deleted_at`;
 * - `actor_id` / `target_id` are plain uuids with NO foreign key — the trail
 *   must survive a hard-deleted user (7-year retention, docs 13 §11), so it is
 *   deliberately decoupled from the `users` lifecycle (no cascade);
 * - indexed by target (the hot read path: a user's history) and by actor.
 */
export class AdminAuditLog1783684557027 implements MigrationInterface {
  name = 'AdminAuditLog1783684557027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL,
        "actor_id" uuid,
        "actor_role" character varying(30),
        "action" character varying(80) NOT NULL,
        "target_type" character varying(40) NOT NULL DEFAULT 'user',
        "target_id" uuid,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "ip" character varying(64),
        "user_agent" character varying(300),
        "request_id" character varying(64),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_target" ON "audit_logs" ("target_type", "target_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_actor" ON "audit_logs" ("actor_id", "created_at")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_action" ON "audit_logs" ("action")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_action"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_target"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_actor"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}
