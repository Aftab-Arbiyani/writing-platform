import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * D5 phase C (docs/48 §5.2) — the DB contraction. Drops the four tables and two columns
 * behind features D5 removed, and deletes the catalogue rows for keys that no longer exist.
 *
 * **This is the only destructive phase of D5, and it lands last on purpose.** Everything
 * before it was reversible by deploying older code: the vocabulary contract (V) removed
 * types and wire fields, but every table it described was still there. After this, the rows
 * are gone. It runs only once V is verified on QA, and there is no production data.
 *
 * ── What it drops ──────────────────────────────────────────────────────────────────────
 *
 * - `ai_messages`, `ai_conversations` — B2 deleted the conversation layer; completions are
 *   stateless and nothing has written these since.
 * - `credit_transactions`, `credit_wallets` — B4 removed the credit economy. The ledger kept
 *   one reader after that (the token rollups on `GET /monetization/usage`, aggregated from
 *   `credit_transactions`), and V removed it; the numbers had already been decaying toward
 *   zero while still being presented as a measurement.
 * - `ai_usage_logs.conversation_id` — a pointer into a table that no longer exists. The rest
 *   of `ai_usage_logs` STAYS and is load-bearing: it is where per-feature allowances are
 *   counted from, and where the admin cost dashboards read.
 * - `purchases.credits_granted` — the count of a currency there is no longer a balance of.
 *   `purchases` itself stays, `kind = 'credits'` rows included: a pack somebody really
 *   bought is history, and billing history describes what happened rather than what the
 *   product currently sells.
 *
 * ── Why the drops are written out rather than generated ────────────────────────────────
 *
 * Generated with `pnpm migration:generate` (never hand-authored, never a made-up timestamp),
 * and then reduced — the generator emitted **214 statements**, of which two were wanted.
 * The rest is the same PRE-EXISTING drift every generation here produces (dropping every FK,
 * both `search_vector` generated columns, and the trigram/partial indexes) between the entity
 * metadata and the hand-tuned SQL of earlier migrations. It belongs to none of D5 and
 * applying it would be destructive. Precedent and reasoning: `1786181711060-UserAiPreference`.
 *
 * The four `DROP TABLE`s had to be ADDED, which is worth knowing before trusting a generator
 * with a removal: **TypeORM's differ only sees tables that still have an entity.** Delete the
 * entity class and the table becomes invisible to it — so a generated migration will never
 * drop it, and the table survives every future generation in silence. (An earlier D5 comment
 * claimed the opposite — that keeping the entity file until this phase stopped a surprise
 * `DROP TABLE`. That was wrong about the mechanism; the sequencing it produced was right for
 * a different reason, which is that a drop should be deliberate and reviewed, as this one is.)
 *
 * ── The data lines ─────────────────────────────────────────────────────────────────────
 *
 * The two `DELETE`s are data, not schema, and are declared here rather than hidden. Both
 * catalogues are seeded INSERT-ONLY, so removing a key from the code never removes its row:
 * without these, six `feature.ai.*` flags and eight prompt templates would linger forever,
 * rendering in the admin flag table and gating nothing.
 *
 * The keys are written out as literals rather than read from `prompt-catalog.ts` or
 * `settings.catalog.ts`. A migration is a historical fact and must keep doing exactly what it
 * did the day it was reviewed; importing application code would let a future refactor of
 * either catalogue silently change what an old migration deletes.
 *
 * ── Reverting ──────────────────────────────────────────────────────────────────────────
 *
 * `down()` restores the SCHEMA exactly — tables, columns, indexes and constraint names — so
 * the migration is reversible in the sense that matters for a deploy. **It does not restore
 * data, and cannot.** The dropped rows are gone, and the deleted catalogue rows do not come
 * back on the next boot either: the seeders insert what the code declares, and the code no
 * longer declares them. Reverting past this point is a schema rollback, not an undo.
 */
export class D5ContractAiConversationsAndCredits1788790567194 implements MigrationInterface {
  name = 'D5ContractAiConversationsAndCredits1788790567194';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Data: catalogue rows for keys that no longer exist in the code ──────────────
    await queryRunner.query(
      `DELETE FROM "ai_prompt_templates" WHERE "key" IN (
         'writing_assistant.continue',
         'writing_assistant.rewrite',
         'writing_assistant.expand',
         'writing_assistant.tone',
         'writing_assistant.freeform',
         'ask_book.answer',
         'semantic_search.answer',
         'recommendations.explain'
       )`,
    );
    await queryRunner.query(
      `DELETE FROM "feature_flags" WHERE "key" IN (
         'feature.ai.askBook.enabled',
         'feature.ai.grammar.enabled',
         'feature.ai.rewrite.enabled',
         'feature.ai.summarization.enabled',
         'feature.ai.semanticSearch.enabled',
         'feature.ai.recommendations.enabled'
       )`,
    );

    // ── Schema: the two columns (generated) ─────────────────────────────────────────
    await queryRunner.query(`ALTER TABLE "ai_usage_logs" DROP COLUMN "conversation_id"`);
    await queryRunner.query(`ALTER TABLE "purchases" DROP COLUMN "credits_granted"`);

    // ── Schema: the four tables (added — see the note above) ────────────────────────
    // Children first, so the order reads correctly even though no FKs were ever declared
    // between these tables.
    await queryRunner.query(`DROP TABLE "ai_messages"`);
    await queryRunner.query(`DROP TABLE "ai_conversations"`);
    await queryRunner.query(`DROP TABLE "credit_transactions"`);
    await queryRunner.query(`DROP TABLE "credit_wallets"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "credit_wallets" (
         "id" uuid NOT NULL,
         "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
         "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
         "user_id" uuid NOT NULL,
         "balance" integer NOT NULL DEFAULT '0',
         "lifetime_granted" integer NOT NULL DEFAULT '0',
         "lifetime_consumed" integer NOT NULL DEFAULT '0',
         CONSTRAINT "PK_8b18298d800c7504182b7a227d2" PRIMARY KEY ("id")
       )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_credit_wallet_user" ON "credit_wallets" ("user_id")`,
    );

    await queryRunner.query(
      `CREATE TABLE "credit_transactions" (
         "id" uuid NOT NULL,
         "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
         "user_id" uuid NOT NULL,
         "wallet_id" uuid NOT NULL,
         "type" character varying(20) NOT NULL,
         "reason" character varying(40) NOT NULL,
         "delta" integer NOT NULL,
         "balance_after" integer NOT NULL,
         "feature" character varying(40),
         "tokens" integer NOT NULL DEFAULT '0',
         "cost_usd" double precision NOT NULL DEFAULT '0',
         "ref_type" character varying(40),
         "ref_id" character varying(255),
         "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
         CONSTRAINT "PK_a408319811d1ab32832ec86fc2c" PRIMARY KEY ("id")
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_credit_txn_user_created" ON "credit_transactions" ("user_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_credit_txn_user_feature" ON "credit_transactions" ("user_id", "feature")`,
    );

    await queryRunner.query(
      `CREATE TABLE "ai_conversations" (
         "id" uuid NOT NULL,
         "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
         "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
         "user_id" uuid NOT NULL,
         "feature" character varying(40) NOT NULL,
         "title" character varying(200),
         "status" character varying(20) NOT NULL DEFAULT 'active',
         "message_count" integer NOT NULL DEFAULT '0',
         "last_message_at" TIMESTAMP WITH TIME ZONE,
         CONSTRAINT "PK_60db12765b82858ba00c8aa4ae2" PRIMARY KEY ("id")
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ai_conversations_user_updated" ON "ai_conversations" ("user_id", "updated_at")`,
    );

    await queryRunner.query(
      `CREATE TABLE "ai_messages" (
         "id" uuid NOT NULL,
         "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
         "conversation_id" uuid NOT NULL,
         "role" character varying(20) NOT NULL,
         "content" text NOT NULL,
         "input_tokens" integer,
         "output_tokens" integer,
         "total_tokens" integer,
         CONSTRAINT "PK_a390434d4a515ba18a41bc996c2" PRIMARY KEY ("id")
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ai_messages_conversation_created" ON "ai_messages" ("conversation_id", "created_at")`,
    );

    await queryRunner.query(
      `ALTER TABLE "purchases" ADD "credits_granted" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(`ALTER TABLE "ai_usage_logs" ADD "conversation_id" uuid`);

    // The deleted catalogue rows are NOT reinserted. The seeders insert what the code
    // declares and the code no longer declares these keys, so re-adding them here would
    // create rows the application would immediately be unable to explain.
  }
}
