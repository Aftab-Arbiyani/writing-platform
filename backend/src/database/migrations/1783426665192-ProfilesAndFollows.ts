import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProfilesAndFollows1783426665192 implements MigrationInterface {
  name = 'ProfilesAndFollows1783426665192';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enums + tables for the profile/follow/settings domain.
    await queryRunner.query(
      `CREATE TYPE "public"."theme_preference" AS ENUM('light', 'dark', 'system')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."visibility" AS ENUM('public', 'unlisted', 'private')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_settings" ("user_id" uuid NOT NULL, "theme" "public"."theme_preference" NOT NULL DEFAULT 'system', "default_piece_visibility" "public"."visibility" NOT NULL DEFAULT 'public', "notification_preferences" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4ed056b9344e6f7d8d46ec4b302" PRIMARY KEY ("user_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "profiles" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "pen_name" character varying(50) NOT NULL, "bio" character varying(500), "avatar_key" text, "cover_key" text, "website_url" character varying(255), "location" character varying(100), "social_links" jsonb NOT NULL DEFAULT '{}', "default_language_id" uuid, "is_private" boolean NOT NULL DEFAULT false, "followers_count" integer NOT NULL DEFAULT '0', "following_count" integer NOT NULL DEFAULT '0', "pieces_count" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_8e520eb4da7dc01d0e190447c8e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_profiles_user" ON "profiles" ("user_id") `);
    await queryRunner.query(
      `CREATE TABLE "profile_genres" ("profile_id" uuid NOT NULL, "genre_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bd551c65a3c0dba0eada2690d3b" PRIMARY KEY ("profile_id", "genre_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_profile_genres_genre" ON "profile_genres" ("genre_id") `,
    );
    await queryRunner.query(`CREATE TYPE "public"."follow_status" AS ENUM('pending', 'accepted')`);
    await queryRunner.query(
      `CREATE TABLE "follows" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "follower_id" uuid NOT NULL, "followee_id" uuid NOT NULL, "status" "public"."follow_status" NOT NULL DEFAULT 'accepted', CONSTRAINT "uq_follows" UNIQUE ("follower_id", "followee_id"), CONSTRAINT "chk_follows_not_self" CHECK ("follower_id" <> "followee_id"), CONSTRAINT "PK_8988f607744e16ff79da3b8a627" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_follows_pending" ON "follows" ("followee_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_follows_followee" ON "follows" ("followee_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_follows_follower" ON "follows" ("follower_id", "created_at") `,
    );
    await queryRunner.query(`CREATE TYPE "public"."text_direction" AS ENUM('ltr', 'rtl')`);
    await queryRunner.query(
      `CREATE TABLE "languages" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying(10) NOT NULL, "name_en" character varying(80) NOT NULL, "native_name" character varying(80) NOT NULL, "direction" "public"."text_direction" NOT NULL DEFAULT 'ltr', "script" character varying(30), "is_active" boolean NOT NULL DEFAULT true, "sort_order" smallint NOT NULL DEFAULT '0', CONSTRAINT "PK_b517f827ca496b29f4d549c631d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_languages_code" ON "languages" ("code") `);
    await queryRunner.query(
      `CREATE TABLE "genres" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "slug" citext NOT NULL, "name" character varying(80) NOT NULL, "description" character varying(300), "is_active" boolean NOT NULL DEFAULT true, "sort_order" smallint NOT NULL DEFAULT '0', CONSTRAINT "PK_80ecd718f0f00dde5d77a9be842" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_genres_slug" ON "genres" ("slug") `);

    // Search prep (docs 04 §6): IMMUTABLE unaccent wrapper (unaccent() itself is only
    // STABLE, so it can't sit in a generated column), a generated tsvector over
    // pen_name (A) + bio (B), and trigram GIN indexes for fuzzy name/username lookup.
    // No search APIs yet — indexing only.
    await queryRunner.query(
      `CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text AS $$ SELECT public.unaccent('public.unaccent', $1) $$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple', immutable_unaccent(coalesce("pen_name", ''))), 'A') || setweight(to_tsvector('simple', immutable_unaccent(coalesce("bio", ''))), 'B')) STORED`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_profiles_search" ON "profiles" USING GIN ("search_vector")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_profiles_pen_name_trgm" ON "profiles" USING GIN ("pen_name" gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_users_username_trgm" ON "users" USING GIN (("username"::text) gin_trgm_ops)`,
    );

    // Foreign keys (docs 04 §3.1/§3.6/§10). Declared here (not as TypeORM relations) so
    // module entities don't cross-import (docs 16 §3.1).
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD CONSTRAINT "fk_profiles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD CONSTRAINT "fk_profiles_language" FOREIGN KEY ("default_language_id") REFERENCES "languages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD CONSTRAINT "fk_user_settings_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "follows" ADD CONSTRAINT "fk_follows_follower" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "follows" ADD CONSTRAINT "fk_follows_followee" FOREIGN KEY ("followee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_genres" ADD CONSTRAINT "fk_profile_genres_profile" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_genres" ADD CONSTRAINT "fk_profile_genres_genre" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profile_genres" DROP CONSTRAINT "fk_profile_genres_genre"`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_genres" DROP CONSTRAINT "fk_profile_genres_profile"`,
    );
    await queryRunner.query(`ALTER TABLE "follows" DROP CONSTRAINT "fk_follows_followee"`);
    await queryRunner.query(`ALTER TABLE "follows" DROP CONSTRAINT "fk_follows_follower"`);
    await queryRunner.query(`ALTER TABLE "user_settings" DROP CONSTRAINT "fk_user_settings_user"`);
    await queryRunner.query(`ALTER TABLE "profiles" DROP CONSTRAINT "fk_profiles_language"`);
    await queryRunner.query(`ALTER TABLE "profiles" DROP CONSTRAINT "fk_profiles_user"`);
    await queryRunner.query(`DROP INDEX "public"."idx_users_username_trgm"`);
    await queryRunner.query(`DROP INDEX "public"."idx_profiles_pen_name_trgm"`);
    await queryRunner.query(`DROP INDEX "public"."idx_profiles_search"`);
    // immutable_unaccent is left in place — search across other tables will reuse it.
    await queryRunner.query(`DROP INDEX "public"."uq_genres_slug"`);
    await queryRunner.query(`DROP TABLE "genres"`);
    await queryRunner.query(`DROP INDEX "public"."uq_languages_code"`);
    await queryRunner.query(`DROP TABLE "languages"`);
    await queryRunner.query(`DROP TYPE "public"."text_direction"`);
    await queryRunner.query(`DROP INDEX "public"."idx_follows_follower"`);
    await queryRunner.query(`DROP INDEX "public"."idx_follows_followee"`);
    await queryRunner.query(`DROP INDEX "public"."idx_follows_pending"`);
    await queryRunner.query(`DROP TABLE "follows"`);
    await queryRunner.query(`DROP TYPE "public"."follow_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_profile_genres_genre"`);
    await queryRunner.query(`DROP TABLE "profile_genres"`);
    await queryRunner.query(`DROP INDEX "public"."uq_profiles_user"`);
    await queryRunner.query(`DROP TABLE "profiles"`);
    await queryRunner.query(`DROP TABLE "user_settings"`);
    await queryRunner.query(`DROP TYPE "public"."visibility"`);
    await queryRunner.query(`DROP TYPE "public"."theme_preference"`);
  }
}
