import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Monetization Platform (AF5) — additive-only. Creates the 12 monetization tables and
 * their indexes; touches NO existing v1 table (the frozen contract is preserved). Mirrors
 * the repo conventions: `id uuid` PK with no DB default (app-assigned UUIDv7), `timestamptz`
 * with `DEFAULT now()`, `jsonb` with SQL-literal defaults, no SQL foreign keys (cross-table
 * integrity is enforced in the services — module isolation, docs 16 §3.3), partial unique
 * indexes for nullable dedupe keys.
 *
 * The generator emitted a full-schema reconciliation diff (dropping every hand-written FK/
 * index across the existing schema); that destructive noise was removed and this migration
 * hand-curated to the additive monetization DDL only — same precedent as the AF1 AI-platform
 * migration. Verified up → down → up on Postgres 16.
 */
export class Monetization1784526743063 implements MigrationInterface {
  name = 'Monetization1784526743063';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "subscriptions" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "tier" character varying(40) NOT NULL, "status" character varying(40) NOT NULL, "interval" character varying(20) NOT NULL, "provider" character varying(40) NOT NULL, "currency" character varying(8) NOT NULL DEFAULT 'usd', "provider_subscription_id" character varying(255), "provider_customer_id" character varying(255), "auto_renew" boolean NOT NULL DEFAULT true, "cancel_at_period_end" boolean NOT NULL DEFAULT false, "current_period_start" TIMESTAMP WITH TIME ZONE, "current_period_end" TIMESTAMP WITH TIME ZONE, "trial_start" TIMESTAMP WITH TIME ZONE, "trial_end" TIMESTAMP WITH TIME ZONE, "grace_period_end" TIMESTAMP WITH TIME ZONE, "canceled_at" TIMESTAMP WITH TIME ZONE, "scheduled_tier" character varying(40), "scheduled_interval" character varying(20), "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_subscription_user" ON "subscriptions" ("user_id")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_subscription_status" ON "subscriptions" ("status")`);
    await queryRunner.query(
      `CREATE INDEX "idx_subscription_period_end" ON "subscriptions" ("current_period_end")`,
    );

    await queryRunner.query(
      `CREATE TABLE "subscription_events" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "subscription_id" uuid NOT NULL, "user_id" uuid NOT NULL, "type" character varying(40) NOT NULL, "from_tier" character varying(40), "to_tier" character varying(40), "from_status" character varying(40), "to_status" character varying(40), "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_7eb5647aa3071cffad0124bceee" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_subscription_event_sub_created" ON "subscription_events" ("subscription_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_subscription_event_type_created" ON "subscription_events" ("type", "created_at")`,
    );

    await queryRunner.query(
      `CREATE TABLE "monetization_customers" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "provider" character varying(40) NOT NULL, "provider_customer_id" character varying(255) NOT NULL, "currency" character varying(8) NOT NULL DEFAULT 'usd', "default_method_type" character varying(40), "card_brand" character varying(40), "card_last4" character varying(4), "tax_region" character varying(16), "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_c0faccf67992586164c5f472bf4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_customer_user_provider" ON "monetization_customers" ("user_id", "provider")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_customer_provider_ref" ON "monetization_customers" ("provider", "provider_customer_id")`,
    );

    await queryRunner.query(
      `CREATE TABLE "credit_wallets" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "balance" integer NOT NULL DEFAULT '0', "lifetime_granted" integer NOT NULL DEFAULT '0', "lifetime_consumed" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_8b18298d800c7504182b7a227d2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_credit_wallet_user" ON "credit_wallets" ("user_id")`,
    );

    await queryRunner.query(
      `CREATE TABLE "credit_transactions" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "wallet_id" uuid NOT NULL, "type" character varying(20) NOT NULL, "reason" character varying(40) NOT NULL, "delta" integer NOT NULL, "balance_after" integer NOT NULL, "feature" character varying(40), "tokens" integer NOT NULL DEFAULT '0', "cost_usd" double precision NOT NULL DEFAULT '0', "ref_type" character varying(40), "ref_id" character varying(255), "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_a408319811d1ab32832ec86fc2c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_credit_txn_user_created" ON "credit_transactions" ("user_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_credit_txn_user_feature" ON "credit_transactions" ("user_id", "feature")`,
    );

    await queryRunner.query(
      `CREATE TABLE "coupons" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying(40) NOT NULL, "type" character varying(40) NOT NULL, "value" integer NOT NULL DEFAULT '0', "currency" character varying(8), "applies_to_tier" character varying(40), "applies_to_interval" character varying(20), "max_redemptions" integer NOT NULL DEFAULT '0', "redemptions" integer NOT NULL DEFAULT '0', "per_user_limit" integer NOT NULL DEFAULT '1', "active" boolean NOT NULL DEFAULT true, "campaign" character varying(120), "description" character varying(255), "starts_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_d7ea8864a0150183770f3e9a8cb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_coupon_code" ON "coupons" ("code")`);
    await queryRunner.query(`CREATE INDEX "idx_coupon_campaign" ON "coupons" ("campaign")`);

    await queryRunner.query(
      `CREATE TABLE "promotion_redemptions" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "coupon_id" uuid NOT NULL, "code" character varying(40) NOT NULL, "user_id" uuid NOT NULL, "type" character varying(40) NOT NULL, "benefit" integer NOT NULL DEFAULT '0', "subscription_id" uuid, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_17e98da71097f78ff330df148f7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_promo_redemption_coupon_user" ON "promotion_redemptions" ("coupon_id", "user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_promo_redemption_user" ON "promotion_redemptions" ("user_id")`,
    );

    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "provider" character varying(40) NOT NULL, "provider_payment_id" character varying(255), "status" character varying(40) NOT NULL, "method" character varying(40) NOT NULL DEFAULT 'unknown', "amount" integer NOT NULL, "currency" character varying(8) NOT NULL DEFAULT 'usd', "subscription_id" uuid, "invoice_id" uuid, "description" character varying(255), "failure_reason" character varying(120), "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payment_user_created" ON "payments" ("user_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_payment_provider_ref" ON "payments" ("provider", "provider_payment_id") WHERE "provider_payment_id" IS NOT NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE "invoices" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "number" character varying(40) NOT NULL, "status" character varying(40) NOT NULL, "provider" character varying(40) NOT NULL DEFAULT 'stripe', "provider_invoice_id" character varying(255), "subscription_id" uuid, "currency" character varying(8) NOT NULL DEFAULT 'usd', "subtotal" integer NOT NULL DEFAULT '0', "tax" integer NOT NULL DEFAULT '0', "total" integer NOT NULL DEFAULT '0', "discount" integer NOT NULL DEFAULT '0', "period_start" TIMESTAMP WITH TIME ZONE, "period_end" TIMESTAMP WITH TIME ZONE, "due_at" TIMESTAMP WITH TIME ZONE, "paid_at" TIMESTAMP WITH TIME ZONE, "hosted_url" character varying(500), "pdf_url" character varying(500), "line_items" jsonb NOT NULL DEFAULT '[]'::jsonb, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_invoice_user_created" ON "invoices" ("user_id", "created_at")`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_invoice_number" ON "invoices" ("number")`);

    await queryRunner.query(
      `CREATE TABLE "entitlement_overrides" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "feature" character varying(40) NOT NULL, "effect" character varying(20) NOT NULL, "limit" integer, "active" boolean NOT NULL DEFAULT true, "expires_at" TIMESTAMP WITH TIME ZONE, "granted_by" uuid, "reason" character varying(255), "source" character varying(120), "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_415bca12175c033f8ee4e9022e6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_entitlement_override_user_feature" ON "entitlement_overrides" ("user_id", "feature")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_entitlement_override_active" ON "entitlement_overrides" ("active")`,
    );

    await queryRunner.query(
      `CREATE TABLE "payment_webhook_events" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "provider" character varying(40) NOT NULL, "provider_event_id" character varying(255) NOT NULL, "type" character varying(120) NOT NULL, "signature_valid" boolean NOT NULL DEFAULT false, "status" character varying(20) NOT NULL, "processed_at" TIMESTAMP WITH TIME ZONE, "error" character varying(500), "payload" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_750875e71d97974be92cee813ba" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_webhook_provider_event" ON "payment_webhook_events" ("provider", "provider_event_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_webhook_status_created" ON "payment_webhook_events" ("status", "created_at")`,
    );

    await queryRunner.query(
      `CREATE TABLE "purchases" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "kind" character varying(20) NOT NULL, "status" character varying(40) NOT NULL, "provider" character varying(40) NOT NULL, "provider_ref" character varying(255), "product_id" character varying(255), "amount" integer NOT NULL DEFAULT '0', "currency" character varying(8) NOT NULL DEFAULT 'usd', "credits_granted" integer NOT NULL DEFAULT '0', "subscription_id" uuid, "receipt_hash" character varying(64), "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_1d55032f37a34c6eceacbbca6b8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_user_created" ON "purchases" ("user_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_purchase_provider_ref" ON "purchases" ("provider", "provider_ref") WHERE "provider_ref" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse order; dropping a table drops its own indexes.
    await queryRunner.query(`DROP TABLE "purchases"`);
    await queryRunner.query(`DROP TABLE "payment_webhook_events"`);
    await queryRunner.query(`DROP TABLE "entitlement_overrides"`);
    await queryRunner.query(`DROP TABLE "invoices"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TABLE "promotion_redemptions"`);
    await queryRunner.query(`DROP TABLE "coupons"`);
    await queryRunner.query(`DROP TABLE "credit_transactions"`);
    await queryRunner.query(`DROP TABLE "credit_wallets"`);
    await queryRunner.query(`DROP TABLE "monetization_customers"`);
    await queryRunner.query(`DROP TABLE "subscription_events"`);
    await queryRunner.query(`DROP TABLE "subscriptions"`);
  }
}
