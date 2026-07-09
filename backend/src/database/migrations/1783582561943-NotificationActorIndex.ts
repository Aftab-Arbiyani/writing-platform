import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Epic 12 hardening — index `notifications.actor_id`.
 *
 * The table indexed `recipient_id` (inbox reads) but not `actor_id`, so any
 * actor-scoped lookup (e.g. cleanup/attribution of notifications caused by a
 * deleted/suspended actor) fell back to a sequential scan. Partial index
 * (`WHERE actor_id IS NOT NULL`) — system notifications have a null actor and are
 * excluded, keeping the index small. Migration-only (mirrors the existing
 * migration-only index pattern; no entity relation is defined).
 */
export class NotificationActorIndex1783582561943 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_notifications_actor"
         ON "notifications" ("actor_id")
       WHERE "actor_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notifications_actor"`);
  }
}
