import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AI Discovery / Search / Recommendation (AF4) — the Retrieval Platform's own tables.
 *
 * Additive-only. Creates two tables: `saved_searches` (a user's saved searches; owner-scoped,
 * unique per (user, name)) and `retrieval_query_logs` (append-only telemetry backing internal
 * Search Analytics + future offline evaluation). Mirrors the house conventions: `id uuid` PK
 * with NO db default (UUIDv7 from the entity `@BeforeInsert`), `timestamptz DEFAULT now()`,
 * `jsonb DEFAULT '[]'::jsonb`, and NO SQL foreign keys (module isolation, docs 16 §3.1).
 * All other AF4 config/prompts/flags are boot-upserted (settings + prompt catalogue) — none
 * seeded here. Verified up → down → up on Postgres 16.
 */
export class AiRetrieval1784386709831 implements MigrationInterface {
  name = 'AiRetrieval1784386709831';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "saved_searches" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "query" character varying(2000) NOT NULL, "query_type" character varying(30), "story_id" character varying(120), CONSTRAINT "PK_saved_searches" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_saved_searches_user_name" ON "saved_searches" ("user_id", "name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_saved_searches_user_created" ON "saved_searches" ("user_id", "created_at") `,
    );

    await queryRunner.query(
      `CREATE TABLE "retrieval_query_logs" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "intent" character varying(20) NOT NULL, "query_type" character varying(30) NOT NULL, "story_id" character varying(120), "sources" jsonb NOT NULL DEFAULT '[]'::jsonb, "total_candidates" integer NOT NULL DEFAULT '0', "returned" integer NOT NULL DEFAULT '0', "retrieval_latency_ms" integer NOT NULL DEFAULT '0', "ranking_latency_ms" integer NOT NULL DEFAULT '0', "context_assembly_ms" integer NOT NULL DEFAULT '0', "llm_latency_ms" integer NOT NULL DEFAULT '0', "total_latency_ms" integer NOT NULL DEFAULT '0', "context_tokens" integer NOT NULL DEFAULT '0', "compression_ratio" real NOT NULL DEFAULT '1', "token_usage" integer NOT NULL DEFAULT '0', "cache_hit" boolean NOT NULL DEFAULT false, "evidence_count" integer NOT NULL DEFAULT '0', "confidence" real NOT NULL DEFAULT '0', "status" character varying(20) NOT NULL DEFAULT 'ok', "failure_reason" character varying(30), CONSTRAINT "PK_retrieval_query_logs" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_retrieval_logs_created" ON "retrieval_query_logs" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_retrieval_logs_user_created" ON "retrieval_query_logs" ("user_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_retrieval_logs_intent_created" ON "retrieval_query_logs" ("intent", "created_at") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_retrieval_logs_intent_created"`);
    await queryRunner.query(`DROP INDEX "public"."idx_retrieval_logs_user_created"`);
    await queryRunner.query(`DROP INDEX "public"."idx_retrieval_logs_created"`);
    await queryRunner.query(`DROP TABLE "retrieval_query_logs"`);
    await queryRunner.query(`DROP INDEX "public"."idx_saved_searches_user_created"`);
    await queryRunner.query(`DROP INDEX "public"."uq_saved_searches_user_name"`);
    await queryRunner.query(`DROP TABLE "saved_searches"`);
  }
}
