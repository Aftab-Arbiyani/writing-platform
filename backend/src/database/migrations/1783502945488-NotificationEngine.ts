import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Notification Engine (E9) — three new tables (docs 04 §3.7 + this epic).
 *
 * Scaffolded with the TypeORM CLI (`pnpm --filter backend migration:create`) so
 * the timestamp is a real `Date.now()` prefix (docs 04 §1.6); the DDL is
 * hand-authored because `migration:generate` is unusable here (plain-FK entities
 * with no relations, docs 16 §3.1).
 *
 * - `notifications` — the per-user inbox. Polymorphic target (`entity_type`/
 *   `entity_id`) + denormalized `data` so listing never joins (docs 04 §3.7).
 *   `read_at`/`archived_at`/`deleted_at` carry the derived status. Indexes:
 *   `idx_notifications_inbox` (recipient, newest-first) excludes soft-deleted;
 *   `idx_notifications_unread` partial backs the O(1) unread count (Redis-cached);
 *   `idx_notifications_recipient_type` backs the `?type=` filter. FKs: recipient →
 *   users CASCADE, actor → users SET NULL (docs 04 §10).
 * - `notification_preferences` — per-user category toggles (PK = user id). FK →
 *   users CASCADE.
 * - `system_notifications` — admin broadcast source records (soft-deletable). FK
 *   `created_by` → users SET NULL.
 */
export class NotificationEngine1783502945488 implements MigrationInterface {
  name = 'NotificationEngine1783502945488';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── notifications ────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "notifications" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "recipient_id" uuid NOT NULL,
        "actor_id" uuid,
        "type" character varying(40) NOT NULL,
        "entity_type" character varying(30),
        "entity_id" uuid,
        "data" jsonb NOT NULL DEFAULT '{}',
        "read_at" TIMESTAMP WITH TIME ZONE,
        "archived_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_inbox" ON "notifications" ("recipient_id", "created_at" DESC) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_unread" ON "notifications" ("recipient_id") WHERE read_at IS NULL AND archived_at IS NULL AND deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_recipient_type" ON "notifications" ("recipient_id", "type") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "fk_notifications_recipient" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "fk_notifications_actor" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // ── notification_preferences ─────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "notification_preferences" (
        "user_id" uuid NOT NULL,
        "follow" boolean NOT NULL DEFAULT true,
        "comment" boolean NOT NULL DEFAULT true,
        "reply" boolean NOT NULL DEFAULT true,
        "reaction" boolean NOT NULL DEFAULT true,
        "mention" boolean NOT NULL DEFAULT true,
        "response" boolean NOT NULL DEFAULT true,
        "system" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_preferences" PRIMARY KEY ("user_id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_preferences" ADD CONSTRAINT "fk_notification_preferences_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // ── system_notifications ─────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "system_notifications" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "title" character varying(150) NOT NULL,
        "body" text NOT NULL,
        "data" jsonb NOT NULL DEFAULT '{}',
        "created_by" uuid,
        "audience" character varying(20) NOT NULL DEFAULT 'all',
        CONSTRAINT "PK_system_notifications" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "system_notifications" ADD CONSTRAINT "fk_system_notifications_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "system_notifications" DROP CONSTRAINT "fk_system_notifications_creator"`,
    );
    await queryRunner.query(`DROP TABLE "system_notifications"`);

    await queryRunner.query(
      `ALTER TABLE "notification_preferences" DROP CONSTRAINT "fk_notification_preferences_user"`,
    );
    await queryRunner.query(`DROP TABLE "notification_preferences"`);

    await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "fk_notifications_actor"`);
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "fk_notifications_recipient"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_notifications_recipient_type"`);
    await queryRunner.query(`DROP INDEX "public"."idx_notifications_unread"`);
    await queryRunner.query(`DROP INDEX "public"."idx_notifications_inbox"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
  }
}
