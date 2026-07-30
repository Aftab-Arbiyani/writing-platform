import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story Intelligence (AF3) — the structured story knowledge graph.
 *
 * Additive-only. Creates four tables: `story_graphs` (aggregate root, one per owner +
 * story), `story_nodes` (entities — characters/locations/events/…), `story_edges`
 * (typed relationships), and `story_analyses` (append-only analysis runs). Mirrors the
 * AF1 conventions: `id uuid` PK with NO db default (UUIDv7 assigned by the entity
 * `@BeforeInsert`), `timestamptz DEFAULT now()`, `jsonb DEFAULT '{}'::jsonb`/`'[]'::jsonb`,
 * and NO SQL foreign keys (cascade is enforced in the repository, docs 16 §3.1). Verified
 * up → down → up on Postgres 16. Prompts + feature flags are boot-upserted (no seed here).
 */
export class StoryIntelligence1784298739240 implements MigrationInterface {
  name = 'StoryIntelligence1784298739240';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "story_graphs" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "story_id" character varying(120) NOT NULL, "title" character varying(200), "node_count" integer NOT NULL DEFAULT '0', "edge_count" integer NOT NULL DEFAULT '0', "analysis_count" integer NOT NULL DEFAULT '0', "last_analyzed_at" TIMESTAMP WITH TIME ZONE, "last_scope" character varying(20), CONSTRAINT "PK_story_graphs" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_story_graphs_user_story" ON "story_graphs" ("user_id", "story_id") `,
    );

    await queryRunner.query(
      `CREATE TABLE "story_nodes" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "graph_id" uuid NOT NULL, "type" character varying(40) NOT NULL, "name" character varying(300) NOT NULL, "normalized_name" character varying(300) NOT NULL, "aliases" jsonb NOT NULL DEFAULT '[]'::jsonb, "summary" text NOT NULL DEFAULT '', "data" jsonb NOT NULL DEFAULT '{}'::jsonb, "confidence" real NOT NULL DEFAULT '0', "mention_count" integer NOT NULL DEFAULT '0', "first_chapter" character varying(120), "evidence" jsonb NOT NULL DEFAULT '[]'::jsonb, CONSTRAINT "PK_story_nodes" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_story_nodes_graph_type" ON "story_nodes" ("graph_id", "type") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_story_nodes_graph_type_name" ON "story_nodes" ("graph_id", "type", "normalized_name") `,
    );

    await queryRunner.query(
      `CREATE TABLE "story_edges" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "graph_id" uuid NOT NULL, "source_id" uuid NOT NULL, "target_id" uuid NOT NULL, "type" character varying(40) NOT NULL, "label" character varying(300) NOT NULL DEFAULT '', "data" jsonb NOT NULL DEFAULT '{}'::jsonb, "confidence" real NOT NULL DEFAULT '0', "evidence" jsonb NOT NULL DEFAULT '[]'::jsonb, CONSTRAINT "PK_story_edges" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "idx_story_edges_graph" ON "story_edges" ("graph_id") `);
    await queryRunner.query(
      `CREATE INDEX "idx_story_edges_source" ON "story_edges" ("source_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_story_edges_graph_src_tgt_type" ON "story_edges" ("graph_id", "source_id", "target_id", "type") `,
    );

    await queryRunner.query(
      `CREATE TABLE "story_analyses" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "graph_id" uuid NOT NULL, "user_id" uuid NOT NULL, "kind" character varying(20) NOT NULL, "scope" character varying(20) NOT NULL, "status" character varying(20) NOT NULL, "summary" text NOT NULL DEFAULT '', "recommendations" jsonb NOT NULL DEFAULT '[]'::jsonb, "confidence_score" real NOT NULL DEFAULT '0', "evidence" jsonb NOT NULL DEFAULT '[]'::jsonb, "affected_chapters" jsonb NOT NULL DEFAULT '[]'::jsonb, "affected_characters" jsonb NOT NULL DEFAULT '[]'::jsonb, "structured" jsonb NOT NULL DEFAULT '{}'::jsonb, "raw_output" text, "provider" character varying(40) NOT NULL DEFAULT '', "model" character varying(120) NOT NULL DEFAULT '', "input_tokens" integer NOT NULL DEFAULT '0', "output_tokens" integer NOT NULL DEFAULT '0', "total_tokens" integer NOT NULL DEFAULT '0', "cost_usd" real NOT NULL DEFAULT '0', CONSTRAINT "PK_story_analyses" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_story_analyses_graph_created" ON "story_analyses" ("graph_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_story_analyses_user_created" ON "story_analyses" ("user_id", "created_at") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_story_analyses_user_created"`);
    await queryRunner.query(`DROP INDEX "public"."idx_story_analyses_graph_created"`);
    await queryRunner.query(`DROP TABLE "story_analyses"`);
    await queryRunner.query(`DROP INDEX "public"."uq_story_edges_graph_src_tgt_type"`);
    await queryRunner.query(`DROP INDEX "public"."idx_story_edges_source"`);
    await queryRunner.query(`DROP INDEX "public"."idx_story_edges_graph"`);
    await queryRunner.query(`DROP TABLE "story_edges"`);
    await queryRunner.query(`DROP INDEX "public"."uq_story_nodes_graph_type_name"`);
    await queryRunner.query(`DROP INDEX "public"."idx_story_nodes_graph_type"`);
    await queryRunner.query(`DROP TABLE "story_nodes"`);
    await queryRunner.query(`DROP INDEX "public"."uq_story_graphs_user_story"`);
    await queryRunner.query(`DROP TABLE "story_graphs"`);
  }
}
