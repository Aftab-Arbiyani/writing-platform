import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B5 (docs/45 §4.10) — the author's own "turn AI off" switch: one additive,
 * defaulted column on the EXISTING `user_settings` satellite.
 *
 * `user_settings` is the preference bag (PK = FK → `users`, `ON DELETE CASCADE`),
 * which is why this lands here rather than on `users` and rather than in a new
 * preferences subsystem — the satellite precedent already exists (docs/04 §1.3).
 *
 * **`DEFAULT true` is the whole deploy-safety story.** Postgres 11+ records a
 * non-volatile column default in the catalogue instead of rewriting the heap, so
 * this is a metadata-only `ALTER` — no table rewrite, no long `ACCESS EXCLUSIVE`
 * hold on a table every authenticated session reads. Every existing row, and every
 * user with no settings row at all, reads as AI-on: nobody's behaviour changes on
 * deploy. (The read path defaults a missing row to `true` for the same reason —
 * `SettingsService.isAiEnabledFor`.)
 *
 * Additive and reversible: `down()` drops the column, restoring the pre-B5 schema
 * exactly. Dropping it loses the users' recorded choices, which is the honest cost
 * of reverting this feature and not something a migration can preserve.
 *
 * Generated with `npm run migration:generate` (never hand-authored, never a made-up
 * timestamp). The generator additionally emitted a large block of PRE-EXISTING drift
 * between the entity metadata and the hand-tuned SQL of earlier migrations — dropping
 * every FK, both `search_vector` generated columns, and the trigram/partial indexes.
 * None of it belongs to B5 and applying it would be destructive, so the body is
 * reduced to the one intended change. That drift is real and is worth its own row;
 * it is not this migration's to carry.
 */
export class UserAiPreference1786181711060 implements MigrationInterface {
  name = 'UserAiPreference1786181711060';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "ai_enabled" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "ai_enabled"`);
  }
}
