# 37 — Monetization Platform Architecture (AF5)

> The reusable monetization architecture: subscriptions, entitlements, AI usage/credits,
> payments behind a replaceable provider port, purchases, feature gating, promotions,
> pricing, and analytics. Additive-only over the frozen `v1` contract. Built on AF1 (AI
> platform), reusing the settings feature-flag subsystem, the domain-event bus,
> notifications, audit, the global cache, and BullMQ.
>
> **Design law:** the **Entitlement Service is the single source of truth for premium
> access**; the **Usage Service is the single source of truth for AI usage**; the
> **Subscription Service owns the lifecycle**; the **Billing Service owns payment
> processing** behind a replaceable port; the **Credit Service owns AI credits**. Never
> scatter feature checks, never couple payment providers to business logic, never trust
> client-side billing — all monetization decisions are server-authoritative.

---

## 1. Folder tree

```
platfrom/
├── packages/shared/src/
│   ├── monetization.ts            # NEW — vocabulary (enums, plan defaults, pure helpers)
│   ├── enums.ts                   # +7 NotificationType, +2 NotificationEntityType (AF5)
│   ├── error-codes.ts             # +25 MONETIZATION/SUBSCRIPTION/PAYMENT/… codes
│   ├── permissions.ts             # +billing.use / billing.manage (catalogue + grants)
│   └── rate-limits.ts             # +billing, +billingWebhook tiers
├── packages/api-types/src/
│   └── monetization.ts            # NEW — client wire contract
└── backend/src/
    ├── common/metering/ai-usage-meter.port.ts     # NEW — AI_USAGE_METER seam (neutral)
    ├── common/events/domain-events.ts             # +6 monetization events
    ├── common/queue/{queue.constants,job-payloads}.ts  # +monetization queue + 2 jobs
    ├── config/payments.config.ts                  # NEW — provider secrets (key-gated)
    ├── config/{env.schema,config.module}.ts       # +Stripe/Apple/Google env
    ├── main.ts                                    # rawBody:true (webhook HMAC)
    ├── modules/ai/orchestration/ai-completion.service.ts  # +optional meter (2 call-sites)
    ├── infrastructure/{infrastructure.module, worker/monetization.processor,
    │     worker/handlers/monetization.handlers}.ts  # async webhook + lifecycle worker
    ├── modules/settings/{settings.catalog,settings.constants}.ts  # +2 JSON settings + category
    ├── modules/notifications/notifications.constants.ts  # +TYPE_PREFERENCE entries
    └── modules/monetization/                      # NEW MODULE
        ├── entities/            # 12 entities (subscription, customer, wallet, credit_txn,
        │                        #   coupon, promotion_redemption, payment, invoice,
        │                        #   subscription_event, entitlement_override,
        │                        #   payment_webhook_event, purchase)
        ├── dto/                 # request + response DTOs
        ├── payments/            # payment-provider.port + registry + adapters/{stripe,apple,google-play}
        ├── listeners/           # monetization-notification.listener
        ├── entitlement.service.ts         # SINGLE SOURCE OF TRUTH for premium access
        ├── subscription.service.ts        # lifecycle owner
        ├── billing.service.ts             # payment processing + webhooks
        ├── usage.service.ts               # AI usage rollups + quota (single source of truth)
        ├── credit.service.ts              # AI credit wallet + ledger
        ├── purchase.service.ts            # one-time + store restore
        ├── pricing.service.ts             # configurable pricing + coupon apply
        ├── promotion.service.ts           # coupons / campaigns
        ├── trial.service.ts               # trial eligibility + window
        ├── invoice.service.ts             # billing documents
        ├── tax.service.ts                 # config-driven tax
        ├── ai-usage-meter.service.ts      # AI_USAGE_METER impl (credit-aware)
        ├── monetization-analytics.service.ts   # admin revenue/subscription/usage analytics
        ├── monetization.config-service.ts # plan catalogue + config over audited settings
        ├── monetization.feature-service.ts# feature-flag gate
        ├── monetization.{constants,types,exceptions,mappers}.ts
        ├── {monetization,billing-webhook,admin-monetization}.controller.ts
        └── monetization.module.ts         # @Global (provides AI_USAGE_METER)
```

Migration: `backend/src/database/migrations/1784526743063-Monetization.ts` (12 tables, additive).

## 2. Monetization architecture

One `MonetizationModule` composes 13 collaborating services plus the payment abstraction.
It is **additive-only** — 12 new tables + `/monetization/*`, `/billing/webhooks/*`, and
`/admin/monetization/*` endpoints; no existing v1 contract changes. Cross-cutting concerns
are **reused, never rebuilt**: feature gating rides `feature.payments.enabled` (already
seeded); notifications/analytics flow through the in-process `DomainEventBus`; audit
through `AuditService`; entitlement caching through the global `CacheService`; async
webhook + lifecycle work through BullMQ (`JOB_ENQUEUER`); admin pricing/plan config through
the audited settings write path. Every service is a distinct class so each named platform
requirement (Entitlement/Subscription/Billing/Usage/Credit/Purchase/Pricing/Trial/Invoice/
Promotion/Tax) is independently testable.

## 3. Entitlement architecture (single source of truth)

`EntitlementService` is the ONLY place premium access is decided. `getSnapshot(userId)`
merges, in order: the plan the user's subscription grants → active administrative /
promotional / temporary **overrides** → time boundaries (trial / grace / period end) →
into one `EntitlementDecision` per `PremiumFeature`. It reads the subscription row directly
(not via `SubscriptionService`) so there is **no dependency cycle** — `SubscriptionService`
and the admin override flow call `invalidate(userId)` after mutating. The snapshot is
memoized in Redis (`CacheService.wrap`, 60 s TTL + explicit invalidation) so the hot path —
the AI usage meter calls it on **every** request — stays cheap. Supported decision states:
`allow · limited · trial · grace_period · deny · expired · suspended · pending_activation ·
cancelled · paused`. Entitlement overrides back Administrative Overrides, Temporary Access,
Promotional Access, and Legacy Plan compatibility (open feature/plan varchars → no migration
to add a capability).

## 4. Subscription architecture

`SubscriptionService` owns the lifecycle **and only that** (payment-provider work lives in
`BillingService`, which calls these methods — one-way, no cycle). Free/Plus/Pro/Enterprise,
monthly/yearly, trials, upgrade (immediate + prorated intent), downgrade / interval switch
(scheduled to period end), renewals, cancellation (now or at period end), reactivation,
pause/resume, grace periods, and expiry. Every transition writes an append-only
`subscription_events` row (history + analytics), emits a `SubscriptionChanged` domain event,
invalidates the cached entitlement, and grants the plan's monthly AI credits on
activation/renewal (reusing `CreditService`). A `runLifecycleSweep()` (BullMQ job) expires
elapsed grace windows + lapsed trials and nudges trials ending soon. One subscription per
user (`uq_subscription_user`).

## 5. Payment architecture (replaceable provider)

`PaymentProviderAdapter` is the one port every provider implements; business logic depends
only on it (via `PaymentRegistryService`), so the provider is replaceable without an
architectural change — adding one is a new adapter class registered under the
`PAYMENT_PROVIDER_ADAPTERS` multi-token (mirrors AF1's `AI_PROVIDER_ADAPTERS`). Shipped
adapters (fetch-based, no SDK, **key-gated → inert until credentials are supplied**):

- **Stripe** — checkout sessions, refunds, and **real HMAC-SHA256 webhook verification**
  (`t=…,v1=…` scheme, constant-time compare, 300 s replay window).
- **Apple App Store** — StoreKit `verifyReceipt` validation with the 21007 sandbox retry;
  App Store Server Notification parsing (full JWS x5c chain check is a documented seam).
- **Google Play** — purchase-token validation via the Play Developer API; RTDN (Pub/Sub)
  parsing (OIDC transport is the authenticity control).

`BillingService` owns processing: `startSubscriptionCheckout` (price → provider → open
subscription), `refund` (audited), and `ingestWebhook` → **signature-verify + persist
idempotently (unique `provider_event_id` = replay protection) + enqueue async processing**
(inline fallback when no queue) → `processWebhookEvent` applies the effect idempotently
(renew / grace / cancel + payment + invoice rows). Webhooks read the **raw request body**
(`rawBody:true` in `main.ts`). Payments + invoices + webhook events are append-only ledgers
= the payment audit trail.

## 6. AI Usage architecture (every AI request passes through the Usage Service)

The mandate is realized without duplicating any token counting. AF1's `AiCompletionService`
is the single choke point every AI feature already funnels through; it now injects an
**`@Optional() @Inject(AI_USAGE_METER)`** hook (defined in neutral `common/metering/`, so the
AI platform never depends on the monetization module — exactly the `JOB_ENQUEUER` pattern).
`MonetizationModule` is `@Global` and provides that token with a **credit-aware meter**:

- `checkQuota` (before generation): entitlement `AiBudget` gate → `UsageService`
  daily/monthly token quota (budget protection) → emits a cost-alert on overflow.
- `recordConsumption` (after): converts the `costUsd` AF1 already computed into credits and
  **debits the credit ledger** (feature-attributed), emitting a low-credit alert.
  When the `feature.payments.enabled` flag is off the meter is a **no-op**, so AF1 keeps its own
  token caps unchanged (backward-compatible dark launch). AF1's `ai_usage_logs` remains the raw
  provider-token record; the monetization `credit_transactions` ledger is the credit/quota
  source of truth (usage rollups, per-feature breakdown, forecast, cost). Covers token +
  credit + model + conversation accounting, daily/monthly/per-feature limits, quota reset
  windows, soft/hard limits, forecasting, cost estimation, budget protection, rate limiting
  (the `aiCompletion` tier), and cost alerts.

## 7. Flutter implementation summary

`lib/features/monetization/` (clean-architecture slice) + `lib/core/billing/` seam. The
store SDK sits behind `StoreBillingGateway` (inert `NoopStoreBillingGateway` default — no
SDK dependency added; a real integration is a provider override in `bootstrap`, docs/40 §41).
Entitlement gating is a UX **hint** via `PremiumGate`/`premiumFeatureAllowed` reading the
server-authoritative snapshot (cached in Hive for offline tolerance; the server re-checks
every action). Screens: **plan comparison** (monthly/yearly, upgrade/downgrade),
**subscription management** (with dedicated trial / grace-period / expired / paused / cancel
experiences + reactivate/pause/resume + restore), **usage dashboard** (windows + forecast +
per-feature), **credit dashboard** (balance + ledger + buy-credits), **billing history**
(invoices + payments). Reuses the AF1 `ApiClient`, `Result`/`guardResult`, the design system
(`QScaffold`/`QCard`/`QButton`/`QErrorView`), Riverpod codegen, and go_router. Gated by the
`QALAM_ENABLE_MONETIZATION` compile flag + `feature.payments.enabled` runtime flag; entry from
Settings → Premium and deep-linkable `/billing/*`. See `qalam-mobile/docs/49`.

## 8. Admin implementation summary

`/admin/monetization/*` (`billing.manage`, PBAC): plan/pricing config (audited settings),
promotion + coupon management, entitlement overrides (grant/revoke), credit adjustments,
payment refunds, and revenue / subscription-conversion / AI-usage-cost analytics (computed
on read from the append-only ledgers). Feature-flag toggling reuses the existing
`/admin/feature-flags`. The React admin UI is a documented seam (this epic delivered the
backend admin API + mobile client, matching the AF4 scope precedent).

## 9. Observability summary

Subscription/payment/webhook/usage/credit/quota events are captured as `DomainEventType`s +
structured logs in `MonetizationNotificationListener`; entitlement decisions carry a
`reason`; webhook events + payments + invoices are append-only audit ledgers; the admin
analytics service exposes revenue, MRR-inputs, active-by-tier, trial/upgrade/downgrade/cancel
counts (conversion + churn), and AI cost by feature. Metrics ride the existing metrics
interceptor + pino logging; per-webhook + job latency surface through the BullMQ worker's
`job.*` taxonomy.

## 10. Security summary

Webhook **HMAC signature verification + replay window** (Stripe) over the raw body; **replay
protection** via unique `(provider, provider_event_id)`; **idempotent** processing +
purchase fulfilment (unique `provider_ref`); **server-side receipt validation** (Apple/Google
`verifyReceipt`/Play API) — the client is never trusted; **server-authoritative entitlement**
(the client gates as a hint only); **least privilege** via `billing.use` vs `billing.manage`;
**audit logging** of every admin/money mutation; **PCI-conscious** design (no PAN/tokens
stored — only card brand/last4; provider holds card data); receipts stored only as a SHA-256
hash. Provider secrets are env-only, blank-defaulted, inert until configured.

## 11. Test coverage

- **Backend:** 650 jest tests pass (93 suites) — **+117 new AF5** across entitlement, credit,
  usage, promotion, subscription, ai-usage-meter, stripe-adapter (HMAC verify + tolerance),
  and billing (webhook signature/duplicate/idempotency). `tsc --noEmit` clean, `nest build`
  clean, eslint clean. Migration verified **up → down → up on Postgres 16**.
- **Shared + api-types:** typecheck + build green.
- **Mobile:** `flutter analyze` **0 issues**; **467 tests** pass (+12 AF5: entitlement, format,
  repository-cache, PremiumGate widget) with only the 2 pre-existing `comment_tile` golden
  diffs unrelated to AF5; **`flutter build apk --release` succeeds**.

## 12. Manual testing guide

1. **Enable:** set `feature.payments.enabled` on via `/admin/feature-flags`; build mobile with
   `--dart-define=QALAM_ENABLE_MONETIZATION=true`. Set `STRIPE_SECRET_KEY` +
   `STRIPE_WEBHOOK_SECRET` (and/or Apple/Google secrets) to activate providers.
2. **Entitlements:** `GET /api/v1/monetization/entitlements` as a free user → `ai_writing`
   denied, `ai_budget` allowed. Grant an override via `POST /admin/monetization/overrides`
   → re-fetch shows it allowed (cache invalidated).
3. **Subscribe (Stripe):** `POST /monetization/subscription {tier:'pro',interval:'monthly',
provider:'stripe'}` → returns a `checkoutUrl`; simulate `invoice.paid` via
   `POST /billing/webhooks/stripe` with a valid `Stripe-Signature` → subscription activates,
   invoice + payment recorded, credits granted, entitlements flip.
4. **Webhook security:** POST a webhook with a bad/absent signature → `WEBHOOK_SIGNATURE_INVALID`;
   re-POST the same event id → recorded as `duplicate`, no double effect.
5. **AI metering:** with monetization on, invoke any AI feature → a `credit_transactions`
   `ai_usage` row appears; exhaust the daily token cap → next AI call → `QUOTA_EXCEEDED` +
   a `quota_exceeded` notification.
6. **Lifecycle:** cancel (at period end) → banner + reactivate; pause → resume; run the
   lifecycle sweep job → an elapsed trial/grace transitions + a trial-ending notification.
7. **Mobile:** Settings → Premium → Subscription; compare plans, open usage + credit
   dashboards, billing history; a locked premium surface shows the `PremiumGate` lock card
   with "See plans".

## 13. Confirmation — no architectural duplication

Every premium capability validates access through the **one** `EntitlementService`
(`decide`/`assertAllowed`/`getSnapshot`); the mobile client gates through the **one**
`entitlementSnapshotProvider`/`PremiumGate`. Every AI request meters through the **one**
`UsageService`/`CreditService` via the `AI_USAGE_METER` hook on AF1's single completion
orchestrator — no parallel usage path, no duplicated token counting. Payment providers are
isolated behind **one** replaceable port; feature flags, notifications, analytics, audit,
cache, and queues are the existing platform services, reused — nothing was rebuilt.
