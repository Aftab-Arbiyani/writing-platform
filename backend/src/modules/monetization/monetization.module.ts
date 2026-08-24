import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AI_USAGE_METER } from '../../common/metering/ai-usage-meter.port';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';
import { AdminMonetizationController } from './admin-monetization.controller';
import { AiUsageMeterService } from './ai-usage-meter.service';
import { BillingWebhookController } from './billing-webhook.controller';
import { BillingService } from './billing.service';
import { CreditService } from './credit.service';
import { Coupon } from './entities/coupon.entity';
import { CreditTransaction } from './entities/credit-transaction.entity';
import { CreditWallet } from './entities/credit-wallet.entity';
import { EntitlementOverride } from './entities/entitlement-override.entity';
import { Invoice } from './entities/invoice.entity';
import { MonetizationCustomer } from './entities/monetization-customer.entity';
import { Payment } from './entities/payment.entity';
import { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';
import { PromotionRedemption } from './entities/promotion-redemption.entity';
import { Purchase } from './entities/purchase.entity';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionEvent } from './entities/subscription-event.entity';
import { EntitlementService } from './entitlement.service';
import { InvoiceService } from './invoice.service';
import { MonetizationAnalyticsService } from './monetization-analytics.service';
import { MonetizationConfigService } from './monetization.config-service';
import { MonetizationController } from './monetization.controller';
import { MonetizationFeatureService } from './monetization.feature-service';
import { MonetizationNotificationListener } from './listeners/monetization-notification.listener';
import { AppleAdapter } from './payments/adapters/apple.adapter';
import { GooglePlayAdapter } from './payments/adapters/google-play.adapter';
import { ManualAdapter } from './payments/adapters/manual.adapter';
import { StripeAdapter } from './payments/adapters/stripe.adapter';
import { PAYMENT_PROVIDER_ADAPTERS } from './payments/payment-provider.port';
import { PaymentRegistryService } from './payments/payment-registry.service';
import { PricingService } from './pricing.service';
import { PromotionService } from './promotion.service';
import { PurchaseService } from './purchase.service';
import { SubscriptionService } from './subscription.service';
import { TaxService } from './tax.service';
import { TrialService } from './trial.service';
import { UsageService } from './usage.service';

/**
 * Monetization Platform (AF5) — the reusable monetization architecture: Entitlement (the
 * single source of truth for premium access), Subscription (lifecycle), Billing (payment
 * processing behind a replaceable provider port), Usage + Credit (AI metering), Purchase,
 * Pricing, Trial, Invoice, Promotion, and Tax services.
 *
 * Additive-only (v1 freeze): 12 new tables + `/monetization/*`, `/billing/webhooks/*`, and
 * `/admin/monetization/*` endpoints; no change to any existing contract. Feature gating
 * REUSES the settings feature-flag subsystem (`feature.payments.enabled`); notifications,
 * analytics, and audit REUSE the existing cross-cutting infrastructure; entitlement caching
 * REUSES the global `CacheService`; async webhook/lifecycle processing REUSES BullMQ.
 *
 * `@Global` so it can provide {@link AI_USAGE_METER} — the credit-aware metering hook the
 * AI orchestrator injects OPTIONALLY (like `JOB_ENQUEUER`), realizing "every AI request
 * passes through the Usage Service" WITHOUT the AI platform depending on this module (no
 * cycle) and without duplicating any token counting.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Subscription,
      SubscriptionEvent,
      MonetizationCustomer,
      CreditWallet,
      CreditTransaction,
      Coupon,
      PromotionRedemption,
      Payment,
      Invoice,
      EntitlementOverride,
      PaymentWebhookEvent,
      Purchase,
    ]),
    AuthModule,
    SettingsModule,
    AuditModule,
    NotificationsModule,
    /*
     * The user directory, for one purpose only: the four admin per-account reads must be able to
     * tell "this account has no billing" from "this id belongs to nobody" (docs/48 §3.22a, B8-1).
     * Before this, both answered a nullable shape, so an operator who mistyped one character of a
     * UUID was told the account was on free with an empty wallet — a plausible answer to a question
     * nobody asked. The three admin TRUST reads already 404 `USER_NOT_FOUND` for the same case
     * (§3.16, A2-4), and two admin surfaces answering "does this id exist?" two different ways is
     * worse than either answer alone, so this converges on the 404.
     *
     * Through the exported `UsersService`, never `UsersRepository` — the no-cross-module-repository
     * rule (docs/16 §3.1) holds. No cycle: `UsersModule` imports only TypeORM + `TaxonomyModule`,
     * which is what made the same import cheap for trust.
     */
    UsersModule,
  ],
  controllers: [MonetizationController, BillingWebhookController, AdminMonetizationController],
  providers: [
    // Payment provider adapters (thin fetch clients) + multi-token registry.
    StripeAdapter,
    AppleAdapter,
    GooglePlayAdapter,
    ManualAdapter,
    {
      provide: PAYMENT_PROVIDER_ADAPTERS,
      useFactory: (
        stripe: StripeAdapter,
        apple: AppleAdapter,
        google: GooglePlayAdapter,
        manual: ManualAdapter,
      ) => [stripe, apple, google, manual],
      inject: [StripeAdapter, AppleAdapter, GooglePlayAdapter, ManualAdapter],
    },
    PaymentRegistryService,
    // Config + platform gate.
    MonetizationConfigService,
    MonetizationFeatureService,
    // Core services.
    EntitlementService,
    CreditService,
    UsageService,
    TrialService,
    PricingService,
    PromotionService,
    TaxService,
    InvoiceService,
    SubscriptionService,
    PurchaseService,
    BillingService,
    MonetizationAnalyticsService,
    // AI metering hook (bound to the global port the AI orchestrator delegates to).
    AiUsageMeterService,
    { provide: AI_USAGE_METER, useExisting: AiUsageMeterService },
    // Event → notification/observability listener.
    MonetizationNotificationListener,
  ],
  exports: [
    EntitlementService,
    MonetizationFeatureService,
    SubscriptionService,
    CreditService,
    UsageService,
    BillingService,
    AI_USAGE_METER,
  ],
})
export class MonetizationModule {}
