import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Owner-scoped index on `subscription_events` (W4-1, docs/48 §3.6).
 *
 * `GET /monetization/subscription/history` used to resolve the caller's subscription first and filter
 * the events by `subscription_id`, so it threw `SUBSCRIPTION_NOT_FOUND` for a user who had none —
 * while the three sibling ledgers on the same controller (`/invoices`, `/payments`, `/purchases`)
 * answered an empty page for exactly that viewer. The service now filters by `user_id` to match them,
 * and this is the index that keeps it a keyset lookup rather than a scan of an append-only table.
 *
 * It mirrors `idx_invoice_user_created` / `idx_payment_user_created` / `idx_purchase_user_created`
 * exactly; `subscription_events` was the only one of the four missing it.
 *
 * **Additive and lock-light.** `CREATE INDEX CONCURRENTLY` takes no `ACCESS EXCLUSIVE` lock, so writes
 * to `subscription_events` continue during the build — which matters because subscription transitions
 * write here and this table only grows. It is also what the repo's own migration guard requires: a
 * plain `CREATE INDEX` is reported as a HIGH finding ("creates index without CONCURRENTLY — table
 * lock").
 *
 * Postgres refuses a concurrent build inside a transaction, and TypeORM wraps each migration in one by
 * default, so both directions `COMMIT` first to leave it. This is the first migration here to need
 * that; the alternative is `migrationsTransactionMode: 'each'`/`'none'` on the data source, which would
 * change transaction behaviour for **every** migration and is not worth it for one index.
 *
 * `IF NOT EXISTS` / `IF EXISTS` keep both directions idempotent — which also makes `down()` safe after
 * an interrupted concurrent build, since that leaves an `INVALID` index behind that still occupies the
 * name.
 */
export class SubscriptionEventUserIndex1784620000000 implements MigrationInterface {
  name = 'SubscriptionEventUserIndex1784620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`COMMIT`);
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_subscription_event_user_created" ON "subscription_events" ("user_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`COMMIT`);
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "idx_subscription_event_user_created"`,
    );
  }
}
