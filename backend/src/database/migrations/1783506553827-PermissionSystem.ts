import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permission System (PBAC refactor) — three NEW, purely additive tables. Nothing
 * existing is altered: `roles`/`user_roles` stay, the JWT is unchanged, and the
 * resolver reads a request's permissions from its `role` claim. So this is a
 * non-breaking migration (existing users keep working; they gain permissions via
 * their role's seeded mappings).
 *
 * Scaffolded with `pnpm --filter backend migration:create` (real Date.now()
 * prefix, docs 04 §1.6); DDL hand-authored (plain-FK entities, docs 16 §3.1).
 *
 * - `permissions` — the concrete permission catalogue (unique `code`).
 * - `role_permissions` — grants per role NAME (wildcards allowed → no FK to the
 *   catalogue); unique (role_name, permission_code), indexed by role_name.
 * - `user_permissions` — direct per-user grants (future overrides); FK user →
 *   users ON DELETE CASCADE; unique (user_id, permission_code).
 */
export class PermissionSystem1783506553827 implements MigrationInterface {
  name = 'PermissionSystem1783506553827';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── permissions (catalogue) ──────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "permissions" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "name" character varying(120) NOT NULL,
        "code" character varying(100) NOT NULL,
        "description" character varying(300),
        "module" character varying(50) NOT NULL,
        CONSTRAINT "PK_permissions" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_permissions_code" ON "permissions" ("code")`);

    // ── role_permissions ─────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "role_permissions" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "role_name" character varying(30) NOT NULL,
        "permission_code" character varying(100) NOT NULL,
        CONSTRAINT "PK_role_permissions" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_role_permissions" ON "role_permissions" ("role_name", "permission_code")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_role_permissions_role" ON "role_permissions" ("role_name")`,
    );

    // ── user_permissions (future direct overrides) ───────────────────────────
    await queryRunner.query(
      `CREATE TABLE "user_permissions" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "permission_code" character varying(100) NOT NULL,
        CONSTRAINT "PK_user_permissions" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_user_permissions" ON "user_permissions" ("user_id", "permission_code")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_permissions_user" ON "user_permissions" ("user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_permissions" ADD CONSTRAINT "fk_user_permissions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_permissions" DROP CONSTRAINT "fk_user_permissions_user"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_user_permissions_user"`);
    await queryRunner.query(`DROP INDEX "public"."uq_user_permissions"`);
    await queryRunner.query(`DROP TABLE "user_permissions"`);

    await queryRunner.query(`DROP INDEX "public"."idx_role_permissions_role"`);
    await queryRunner.query(`DROP INDEX "public"."uq_role_permissions"`);
    await queryRunner.query(`DROP TABLE "role_permissions"`);

    await queryRunner.query(`DROP INDEX "public"."uq_permissions_code"`);
    await queryRunner.query(`DROP TABLE "permissions"`);
  }
}
