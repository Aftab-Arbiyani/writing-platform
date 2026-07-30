import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * System Settings module (E12.8) — two new, purely additive tables: `settings`
 * (the generic key-value configuration store) and `feature_flags` (the per-flag
 * rollout model). Nothing existing is altered, so this is non-breaking: no column
 * changes, no backfill, no locks on populated tables (docs 25 backend freeze —
 * additive-only over `v1`).
 *
 * Scaffolded with `pnpm --filter backend migration:create` (real Date.now()
 * prefix, docs 04 §1.6); DDL hand-authored to match the entities. Both tables are
 * seeded at boot from the TypeScript catalogue (`SettingsService.onModuleInit`),
 * so this migration creates SCHEMA only — no data. Values are `jsonb`; keys /
 * categories are `varchar` (open sets validated in code, docs 04 §1.7). No FK on
 * `updated_by` (the config must survive a hard-deleted admin, cf. `audit_logs`);
 * no soft-delete (config is not a recoverability domain, docs 04 §1.5).
 */
export class SystemSettings1783761518342 implements MigrationInterface {
  name = 'SystemSettings1783761518342';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "settings" (
        "id" uuid NOT NULL,
        "key" character varying(120) NOT NULL,
        "category" character varying(40) NOT NULL,
        "value" jsonb NOT NULL,
        "data_type" character varying(20) NOT NULL,
        "default_value" jsonb NOT NULL,
        "validation_rules" jsonb NOT NULL DEFAULT '{}',
        "description" text NOT NULL DEFAULT '',
        "editable" boolean NOT NULL DEFAULT true,
        "environment_scope" character varying(20) NOT NULL DEFAULT 'all',
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_settings" PRIMARY KEY ("id"),
        CONSTRAINT "uq_settings_key" UNIQUE ("key")
      )`,
    );
    await queryRunner.query(`CREATE INDEX "idx_settings_category" ON "settings" ("category")`);

    await queryRunner.query(
      `CREATE TABLE "feature_flags" (
        "id" uuid NOT NULL,
        "key" character varying(120) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT false,
        "rollout_percentage" integer NOT NULL DEFAULT 0,
        "environment" character varying(20) NOT NULL DEFAULT 'all',
        "description" text NOT NULL DEFAULT '',
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feature_flags" PRIMARY KEY ("id"),
        CONSTRAINT "uq_feature_flags_key" UNIQUE ("key")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_feature_flags_enabled" ON "feature_flags" ("enabled")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_feature_flags_enabled"`);
    await queryRunner.query(`DROP TABLE "feature_flags"`);
    await queryRunner.query(`DROP INDEX "public"."idx_settings_category"`);
    await queryRunner.query(`DROP TABLE "settings"`);
  }
}
