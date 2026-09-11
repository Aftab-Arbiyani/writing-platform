import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rebrand Qalam → Umberleaf, settings half. A **data** migration: no schema changes.
 *
 * `settings` is a catalogue-backed key-value table, and `SettingsRepository.syncDefinitions`
 * upserts the TS catalogue with **`.orIgnore()`** — insert-or-ignore. For a row that already
 * exists it does nothing at all, so changing `settings.catalog.ts` is **dead code on every
 * database that has already booted once**. Without this migration the rename is invisible in
 * production while every test stays green (a fresh test DB inserts the new defaults and hides
 * the bug). Same shape as the PBAC seed defect: an `orIgnore` seed never updates.
 *
 * Both jsonb columns move, and that is the part worth reading twice:
 * - `value`         — the effective value. Guarded on the old value so a genuinely
 *                     customised platform name is never clobbered. If an admin typed
 *                     "Qalam" by hand, it is indistinguishable from the default and is
 *                     treated as one; the only party who would have is us.
 * - `default_value` — the catalogue default the admin UI resets to. Machine-owned, not
 *                     user-owned. **Skip this and "reset to default" restores the old brand**,
 *                     which is exactly the kind of thing that surfaces months later.
 *
 * `email.fromAddress` (`no-reply@qalam.app`) is deliberately NOT touched: it is a domain, not
 * a brand word, and it cannot move until the umberleaf.com MX records exist. It travels with
 * the infrastructure phase.
 *
 * `value` and `default_value` are `jsonb`, so a string is stored WITH its JSON quotes —
 * hence `'"Qalam"'::jsonb`, not `'Qalam'`. Comparing against the unquoted form matches
 * nothing and the migration would silently no-op.
 */
export class RenameBrandInSettings1789113443472 implements MigrationInterface {
  name = 'RenameBrandInSettings1789113443472';

  private static readonly KEYS = ['platform.name', 'email.fromName'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "settings" SET "value" = '"Umberleaf"'::jsonb
        WHERE "key" = ANY($1) AND "value" = '"Qalam"'::jsonb`,
      [RenameBrandInSettings1789113443472.KEYS],
    );
    await queryRunner.query(
      `UPDATE "settings" SET "default_value" = '"Umberleaf"'::jsonb
        WHERE "key" = ANY($1) AND "default_value" = '"Qalam"'::jsonb`,
      [RenameBrandInSettings1789113443472.KEYS],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Exact inverse, scoped to the new value so a post-rename edit by an admin survives
    // a rollback. It cannot survive one they made TO "Umberleaf" — documented, not solved.
    await queryRunner.query(
      `UPDATE "settings" SET "value" = '"Qalam"'::jsonb
        WHERE "key" = ANY($1) AND "value" = '"Umberleaf"'::jsonb`,
      [RenameBrandInSettings1789113443472.KEYS],
    );
    await queryRunner.query(
      `UPDATE "settings" SET "default_value" = '"Qalam"'::jsonb
        WHERE "key" = ANY($1) AND "default_value" = '"Umberleaf"'::jsonb`,
      [RenameBrandInSettings1789113443472.KEYS],
    );
  }
}
