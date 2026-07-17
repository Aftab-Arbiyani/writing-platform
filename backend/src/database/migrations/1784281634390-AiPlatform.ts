import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AF1 — AI Platform tables (Phase 2 AI foundation). Purely ADDITIVE (docs/25
 * freeze §8): seven new `ai_*` tables + their indexes, no change to any existing
 * table, column, constraint, or index.
 *
 * NOTE: `migration:generate` also emitted a large set of unrelated DROP/RECREATE
 * statements for pre-existing objects (the `search_vector` tsvector generated
 * columns, custom-named FKs, and partial/trigram indexes with WHERE clauses).
 * Those are a known TypeORM introspection artifact — its schema differ does not
 * round-trip hand-tuned DDL — NOT real drift. They were intentionally removed so
 * this migration is safe and additive-only. Verified with up → down → up.
 */
export class AiPlatform1784281634390 implements MigrationInterface {
  name = 'AiPlatform1784281634390';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ai_usage_logs" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "feature" character varying(40) NOT NULL, "provider" character varying(40) NOT NULL, "model" character varying(120) NOT NULL, "input_tokens" integer NOT NULL DEFAULT '0', "output_tokens" integer NOT NULL DEFAULT '0', "total_tokens" integer NOT NULL DEFAULT '0', "cost_usd" double precision NOT NULL DEFAULT '0', "conversation_id" uuid, "request_id" character varying(64), CONSTRAINT "PK_7f42670987a1de5cb209a77e925" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "idx_ai_usage_feature" ON "ai_usage_logs" ("feature") `);
    await queryRunner.query(
      `CREATE INDEX "idx_ai_usage_user_created" ON "ai_usage_logs" ("user_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ai_models" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "provider" character varying(40) NOT NULL, "model_id" character varying(120) NOT NULL, "display_name" character varying(120) NOT NULL, "context_window" integer NOT NULL, "max_output_tokens" integer NOT NULL, "capabilities" jsonb NOT NULL DEFAULT '[]'::jsonb, "supports_streaming" boolean NOT NULL DEFAULT false, "supports_vision" boolean NOT NULL DEFAULT false, "supports_json_mode" boolean NOT NULL DEFAULT false, "input_cost_per_million" double precision NOT NULL DEFAULT '0', "output_cost_per_million" double precision NOT NULL DEFAULT '0', "availability" character varying(20) NOT NULL DEFAULT 'available', "is_default" boolean NOT NULL DEFAULT false, "updated_by" uuid, CONSTRAINT "uq_ai_models_provider_model" UNIQUE ("provider", "model_id"), CONSTRAINT "PK_3d254744f0bcf6f35be5826e25e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "idx_ai_models_provider" ON "ai_models" ("provider") `);
    await queryRunner.query(
      `CREATE TABLE "ai_prompt_templates" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "key" character varying(120) NOT NULL, "version" integer NOT NULL DEFAULT '1', "category" character varying(20) NOT NULL, "description" character varying(500) NOT NULL DEFAULT '', "body" text NOT NULL, "variables" jsonb NOT NULL DEFAULT '[]'::jsonb, "active" boolean NOT NULL DEFAULT true, "updated_by" uuid, CONSTRAINT "uq_ai_prompt_key_version" UNIQUE ("key", "version"), CONSTRAINT "PK_2aa904ab525b17c3e793e53a3da" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ai_prompt_key_active" ON "ai_prompt_templates" ("key", "active") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ai_messages" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "conversation_id" uuid NOT NULL, "role" character varying(20) NOT NULL, "content" text NOT NULL, "input_tokens" integer, "output_tokens" integer, "total_tokens" integer, CONSTRAINT "PK_a390434d4a515ba18a41bc996c2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ai_messages_conversation_created" ON "ai_messages" ("conversation_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ai_conversations" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "feature" character varying(40) NOT NULL, "title" character varying(200), "status" character varying(20) NOT NULL DEFAULT 'active', "message_count" integer NOT NULL DEFAULT '0', "last_message_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_60db12765b82858ba00c8aa4ae2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ai_conversations_user_updated" ON "ai_conversations" ("user_id", "updated_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ai_org_config" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "provider" character varying(40) NOT NULL, "model" character varying(120) NOT NULL DEFAULT '', "params" jsonb NOT NULL DEFAULT '{}'::jsonb, "streaming" boolean NOT NULL DEFAULT true, "safety" jsonb NOT NULL DEFAULT '{}'::jsonb, "updated_by" uuid, CONSTRAINT "PK_2b36e31a506f7522693eb258a68" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "ai_config_overrides" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "provider" character varying(40), "model" character varying(120), "params" jsonb, "streaming" boolean, CONSTRAINT "PK_46d7a84d6871b968ad28be5980b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_ai_config_overrides_user" ON "ai_config_overrides" ("user_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."uq_ai_config_overrides_user"`);
    await queryRunner.query(`DROP TABLE "ai_config_overrides"`);
    await queryRunner.query(`DROP TABLE "ai_org_config"`);
    await queryRunner.query(`DROP INDEX "public"."idx_ai_conversations_user_updated"`);
    await queryRunner.query(`DROP TABLE "ai_conversations"`);
    await queryRunner.query(`DROP INDEX "public"."idx_ai_messages_conversation_created"`);
    await queryRunner.query(`DROP TABLE "ai_messages"`);
    await queryRunner.query(`DROP INDEX "public"."idx_ai_prompt_key_active"`);
    await queryRunner.query(`DROP TABLE "ai_prompt_templates"`);
    await queryRunner.query(`DROP INDEX "public"."idx_ai_models_provider"`);
    await queryRunner.query(`DROP TABLE "ai_models"`);
    await queryRunner.query(`DROP INDEX "public"."idx_ai_usage_user_created"`);
    await queryRunner.query(`DROP INDEX "public"."idx_ai_usage_feature"`);
    await queryRunner.query(`DROP TABLE "ai_usage_logs"`);
  }
}
