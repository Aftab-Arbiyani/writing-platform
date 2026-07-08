import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthAndIdentity1783424099376 implements MigrationInterface {
  name = 'AuthAndIdentity1783424099376';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Required extensions (docs 04 §1.8): citext for case-insensitive
    // email/username; unaccent + pg_trgm for search (used from E8). Created
    // here since these are the first tables to need citext.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS citext`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(
      `CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deactivated')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "email" citext NOT NULL, "email_verified_at" TIMESTAMP WITH TIME ZONE, "password_hash" text, "username" citext NOT NULL, "status" "public"."user_status" NOT NULL DEFAULT 'active', "last_login_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "chk_users_username_format" CHECK (username ~ '^[a-z0-9_]{3,30}$'), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_username" ON "users" ("username") `);
    await queryRunner.query(
      `CREATE TABLE "user_roles" ("user_id" uuid NOT NULL, "role_id" uuid NOT NULL, "granted_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_23ed6f04fe43066df08379fd034" PRIMARY KEY ("user_id", "role_id"))`,
    );
    await queryRunner.query(`CREATE INDEX "idx_user_roles_role" ON "user_roles" ("role_id") `);
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" citext NOT NULL, "rank" smallint NOT NULL, "description" character varying(200), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_roles_name" ON "roles" ("name") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_roles_rank" ON "roles" ("rank") `);
    await queryRunner.query(
      `CREATE TABLE "verification_tokens" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "token_hash" text NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_f2d4d7a2aa57ef199e61567db22" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_verification_tokens_user" ON "verification_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_verification_tokens_hash" ON "verification_tokens" ("token_hash") `,
    );
    await queryRunner.query(`CREATE TYPE "public"."auth_provider" AS ENUM('google', 'apple')`);
    await queryRunner.query(
      `CREATE TABLE "auth_identities" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "provider" "public"."auth_provider" NOT NULL, "provider_user_id" character varying(255) NOT NULL, "email" citext, CONSTRAINT "uq_auth_identities_user_provider" UNIQUE ("user_id", "provider"), CONSTRAINT "uq_auth_identities_provider_subject" UNIQUE ("provider", "provider_user_id"), CONSTRAINT "PK_63a29aebcddd09448dbeee4666b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_auth_identities_user" ON "auth_identities" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "token_hash" text NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_password_reset_tokens_user" ON "password_reset_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_password_reset_tokens_hash" ON "password_reset_tokens" ("token_hash") `,
    );

    // Foreign keys with the ON DELETE behavior fixed in docs 04 §3.1/§10.
    // Declared here (not as TypeORM relations) so the auth module's entities
    // don't import the users entities — boundary stays clean (docs 16 §3.1).
    await queryRunner.query(
      `ALTER TABLE "auth_identities" ADD CONSTRAINT "fk_auth_identities_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_granted_by" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "verification_tokens" ADD CONSTRAINT "fk_verification_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "fk_password_reset_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "fk_password_reset_tokens_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "verification_tokens" DROP CONSTRAINT "fk_verification_tokens_user"`,
    );
    await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "fk_user_roles_granted_by"`);
    await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "fk_user_roles_role"`);
    await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "fk_user_roles_user"`);
    await queryRunner.query(
      `ALTER TABLE "auth_identities" DROP CONSTRAINT "fk_auth_identities_user"`,
    );
    // Extensions are left in place on down() — other schema may rely on them.
    await queryRunner.query(`DROP INDEX "public"."uq_password_reset_tokens_hash"`);
    await queryRunner.query(`DROP INDEX "public"."idx_password_reset_tokens_user"`);
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."idx_auth_identities_user"`);
    await queryRunner.query(`DROP TABLE "auth_identities"`);
    await queryRunner.query(`DROP TYPE "public"."auth_provider"`);
    await queryRunner.query(`DROP INDEX "public"."uq_verification_tokens_hash"`);
    await queryRunner.query(`DROP INDEX "public"."idx_verification_tokens_user"`);
    await queryRunner.query(`DROP TABLE "verification_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."uq_roles_rank"`);
    await queryRunner.query(`DROP INDEX "public"."uq_roles_name"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP INDEX "public"."idx_user_roles_role"`);
    await queryRunner.query(`DROP TABLE "user_roles"`);
    await queryRunner.query(`DROP INDEX "public"."uq_users_username"`);
    await queryRunner.query(`DROP INDEX "public"."uq_users_email"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."user_status"`);
  }
}
