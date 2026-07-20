import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AF6 — Collaboration, Publishing & Trust Platform.
 *
 * ADDITIVE-ONLY: creates the 12 new tables (trust, collaboration, publishing).
 * The generator's full-schema reconciliation diff (dropping FKs, the generated
 * `search_vector` columns, partial indexes, and re-adding unique constraints on
 * existing tables) has been STRIPPED — those are the generator misreading the
 * hand-authored Phase-1/AF1–AF5 schema, not real AF6 changes (see the AF5
 * `Monetization` migration header for the same treatment). All ownership columns
 * are plain `uuid` (no SQL FKs — cross-table integrity lives in the services,
 * docs 16 §3.1). `id` is an app-assigned UUIDv7 with no DB default.
 *
 * Verified up → down → up on PostgreSQL 16.
 */
export class Af6CollaborationTrust1784533235398 implements MigrationInterface {
  name = 'Af6CollaborationTrust1784533235398';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Trust & Safety ────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "trust_profiles" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "score" integer NOT NULL DEFAULT '50', "level" character varying(20) NOT NULL DEFAULT 'member', "active_strike_weight" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_77d1f25a819dabd693f288c993c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_trust_profiles_user" ON "trust_profiles" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_strikes" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "severity" character varying(20) NOT NULL, "reason" text NOT NULL, "weight" integer NOT NULL, "report_id" uuid, "issued_by_id" uuid NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE, "revoked_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_fd06207433afafda1adf98d8a6a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_strikes_user" ON "user_strikes" ("user_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_restrictions" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "type" character varying(20) NOT NULL, "scope" character varying(20) NOT NULL DEFAULT 'global', "reason" text NOT NULL, "issued_by_id" uuid NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE, "lifted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_39ff399710977d6e2a79f5ee9ca" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_restrictions_user" ON "user_restrictions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_blocks" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "blocker_id" uuid NOT NULL, "blocked_id" uuid NOT NULL, "kind" character varying(10) NOT NULL, CONSTRAINT "PK_0bae5f5cab7574a84889462187c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_user_blocks" ON "user_blocks" ("blocker_id", "blocked_id", "kind")`,
    );

    // ── Collaboration ─────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "story_memberships" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "story_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" character varying(20) NOT NULL, "invited_by_id" uuid, CONSTRAINT "PK_4f464e9e3e870b09f7d9400d48e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_story_membership_role" ON "story_memberships" ("story_id", "role")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_story_membership" ON "story_memberships" ("story_id", "user_id")`,
    );
    await queryRunner.query(
      `CREATE TABLE "story_invitations" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "story_id" uuid NOT NULL, "inviter_id" uuid NOT NULL, "invitee_id" uuid NOT NULL, "role" character varying(20) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "token" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "responded_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_2bcef4e5c929f812434c183dadc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_story_invitation_story" ON "story_invitations" ("story_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_story_invitation_invitee" ON "story_invitations" ("invitee_id", "status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_story_invitation_token" ON "story_invitations" ("token")`,
    );
    await queryRunner.query(
      `CREATE TABLE "collaboration_comments" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "story_id" uuid NOT NULL, "author_id" uuid NOT NULL, "parent_id" uuid, "kind" character varying(10) NOT NULL DEFAULT 'general', "anchor" jsonb, "body" text NOT NULL, "status" character varying(10) NOT NULL DEFAULT 'open', "resolved_by_id" uuid, "mentions" jsonb NOT NULL DEFAULT '[]'::jsonb, CONSTRAINT "PK_a02063c9ea7676d481561e72efe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collab_comment_parent" ON "collaboration_comments" ("parent_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collab_comment_story" ON "collaboration_comments" ("story_id", "status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE TABLE "story_suggestions" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "story_id" uuid NOT NULL, "author_id" uuid NOT NULL, "anchor" jsonb NOT NULL, "original_text" text NOT NULL, "suggested_text" text NOT NULL, "status" character varying(12) NOT NULL DEFAULT 'pending', "resolved_by_id" uuid, "resolved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_700d6ab436a9c2bee7b601f98cf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_story_suggestion" ON "story_suggestions" ("story_id", "status")`,
    );
    await queryRunner.query(
      `CREATE TABLE "collaboration_activities" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "story_id" uuid NOT NULL, "actor_id" uuid NOT NULL, "type" character varying(40) NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_469d7eab3cc3bc23a08eda04f81" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collab_activity_story" ON "collaboration_activities" ("story_id", "created_at")`,
    );

    // ── Publishing ──────────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "review_sessions" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "story_id" uuid NOT NULL, "requested_by_id" uuid NOT NULL, "state" character varying(20) NOT NULL DEFAULT 'in_review', "reviewer_id" uuid, "decision" character varying(20), "notes" text, "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL, "decided_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_4ba8e495ccd798beff61750b817" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_review_session_story" ON "review_sessions" ("story_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_review_session_story_state" ON "review_sessions" ("story_id", "state")`,
    );
    await queryRunner.query(
      `CREATE TABLE "story_snapshots" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "story_id" uuid NOT NULL, "version" integer NOT NULL, "title" character varying(200) NOT NULL, "content" jsonb NOT NULL, "word_count" integer NOT NULL DEFAULT '0', "reason" character varying(20) NOT NULL, "created_by_id" uuid NOT NULL, CONSTRAINT "PK_be914a6fa6b2c8233c738829da5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_story_snapshot_story_version" ON "story_snapshots" ("story_id", "version")`,
    );
    await queryRunner.query(
      `CREATE TABLE "publication_events" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "story_id" uuid NOT NULL, "actor_id" uuid NOT NULL, "type" character varying(40) NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_cdad8f63a496bc43c7aae832053" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_publication_event_story_created" ON "publication_events" ("story_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_publication_event_story_created"`);
    await queryRunner.query(`DROP TABLE "publication_events"`);
    await queryRunner.query(`DROP INDEX "public"."idx_story_snapshot_story_version"`);
    await queryRunner.query(`DROP TABLE "story_snapshots"`);
    await queryRunner.query(`DROP INDEX "public"."idx_review_session_story_state"`);
    await queryRunner.query(`DROP INDEX "public"."idx_review_session_story"`);
    await queryRunner.query(`DROP TABLE "review_sessions"`);
    await queryRunner.query(`DROP INDEX "public"."idx_collab_activity_story"`);
    await queryRunner.query(`DROP TABLE "collaboration_activities"`);
    await queryRunner.query(`DROP INDEX "public"."idx_story_suggestion"`);
    await queryRunner.query(`DROP TABLE "story_suggestions"`);
    await queryRunner.query(`DROP INDEX "public"."idx_collab_comment_story"`);
    await queryRunner.query(`DROP INDEX "public"."idx_collab_comment_parent"`);
    await queryRunner.query(`DROP TABLE "collaboration_comments"`);
    await queryRunner.query(`DROP INDEX "public"."uq_story_invitation_token"`);
    await queryRunner.query(`DROP INDEX "public"."idx_story_invitation_invitee"`);
    await queryRunner.query(`DROP INDEX "public"."idx_story_invitation_story"`);
    await queryRunner.query(`DROP TABLE "story_invitations"`);
    await queryRunner.query(`DROP INDEX "public"."uq_story_membership"`);
    await queryRunner.query(`DROP INDEX "public"."idx_story_membership_role"`);
    await queryRunner.query(`DROP TABLE "story_memberships"`);
    await queryRunner.query(`DROP INDEX "public"."uq_user_blocks"`);
    await queryRunner.query(`DROP TABLE "user_blocks"`);
    await queryRunner.query(`DROP INDEX "public"."idx_user_restrictions_user"`);
    await queryRunner.query(`DROP TABLE "user_restrictions"`);
    await queryRunner.query(`DROP INDEX "public"."idx_user_strikes_user"`);
    await queryRunner.query(`DROP TABLE "user_strikes"`);
    await queryRunner.query(`DROP INDEX "public"."uq_trust_profiles_user"`);
    await queryRunner.query(`DROP TABLE "trust_profiles"`);
  }
}
