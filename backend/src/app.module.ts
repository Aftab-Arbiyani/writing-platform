/**
 * Root module — composes the infrastructure modules and mounts feature modules.
 * The Phase-0 inline wiring (config/logger/db/queue) now lives in dedicated
 * modules so each concern is isolated and testable.
 *
 * Import order is deliberate:
 * 1. AppConfigModule  — global, validated env; every other module's async
 *    factory injects its typed config.
 * 2. CommonModule     — applies RequestIdMiddleware BEFORE the logger, so the
 *    correlation id exists when nestjs-pino binds it (ADR §9).
 * 3. AppLoggerModule  — request logging (pino-http).
 * 4. DatabaseModule / RedisModule / QueueModule — data + async infrastructure.
 * 5. HealthModule     — liveness/readiness probes.
 * 6. Feature modules  — AuthModule (E1); the rest of the map register here
 *    across Phase 1 (see src/modules/README.md).
 */
import { Module } from '@nestjs/common';

import { CommonModule } from './common/common.module';
import { AdminModule } from './modules/admin/admin.module';
import { AiModule } from './modules/ai/ai.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditModule } from './modules/audit/audit.module';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { AppLoggerModule } from './logger/logger.module';
import { MailModule } from './mail/mail.module';
import { MediaModule } from './media/media.module';
import { AuthModule } from './modules/auth/auth.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { EngagementModule } from './modules/engagement/engagement.module';
import { FeedModule } from './modules/feed/feed.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { MonetizationModule } from './modules/monetization/monetization.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { PiecesModule } from './modules/pieces/pieces.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { PolicyModule } from './modules/policy/policy.module';
import { PolicyIntegrationModule } from './modules/policy-integration/policy-integration.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { PublishingModule } from './modules/publishing/publishing.module';
import { RetrievalModule } from './modules/retrieval/retrieval.module';
import { TrustModule } from './modules/trust/trust.module';
import { SearchModule } from './modules/search/search.module';
import { SecurityModule } from './modules/security/security.module';
import { SettingsModule } from './modules/settings/settings.module';
import { StoryIntelligenceModule } from './modules/story-intelligence/story-intelligence.module';
import { TaxonomyModule } from './modules/taxonomy/taxonomy.module';
import { UsersModule } from './modules/users/users.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    AppConfigModule,
    CommonModule,
    AppLoggerModule,
    DatabaseModule,
    RedisModule,
    QueueModule,
    MailModule,
    MediaModule,
    HealthModule,
    TaxonomyModule,
    AuthModule,
    PermissionsModule,
    UsersModule,
    PiecesModule,
    EngagementModule,
    FeedModule,
    SearchModule,
    NotificationsModule,
    AnalyticsModule,
    // Admin completion patch (E12.5): the shared audit trail + the admin API
    // surface (controllers only) that A4 consumes. Placed after the feature
    // modules it orchestrates; before the infrastructure backbone.
    AuditModule,
    AdminModule,
    ModerationModule,
    // System Settings (E12.8): generic config store + feature flags + maintenance
    // mode. Additive tables; reuses the audit trail + Redis cache. Backs Phase-4
    // Epic A7 (admin settings UI).
    SettingsModule,
    // Security & Compliance Platform (P7.2): the central point for security
    // policy enforcement — reusable validation layer, field encryption + key
    // management, threat detection + scoring, security-audit facade over the
    // immutable trail, and the security-policy resolver. @Global; composes the
    // audit + settings + Redis + metrics platforms without duplicating authz
    // (Policy Engine), premium access (Entitlement), or rate limiting.
    SecurityModule,
    // Privacy + Compliance Platforms (P7.2): self-service consent, GDPR data
    // export (Art. 15) + erasure (Art. 17) via self-registered contributor ports,
    // a data-retention registry, and compliance reporting. Consent/DSR state is
    // durable Redis; every event is immutable in audit_logs. Compose the Security
    // + Audit platforms; no new tables, no duplication.
    PrivacyModule,
    ComplianceModule,
    // AI Platform (AF1 — Phase 2 AI foundation): provider abstraction, model +
    // prompt registries, context pipeline, token accounting, conversations,
    // configuration, safety hooks, completion orchestrator. Additive-only; reuses
    // the settings feature-flag subsystem for gating. Placed after SettingsModule
    // (whose SettingsService it consumes) and before the infrastructure backbone.
    AiModule,
    // Story Intelligence (AF3): the structured story knowledge graph + analyses.
    // Imports AiModule and reuses AiCompletionService for every analysis — never
    // bypasses AF1. Placed after AiModule (its dependency).
    StoryIntelligenceModule,
    // AI Discovery / Search / Recommendation (AF4): the reusable Retrieval Platform
    // (planner → retrievers → context assembly → ranking) + its consumers (semantic
    // search, Ask My Book, story explorer, recommendations). Reuses AF1 (orchestrator),
    // AF3 (graph SSOT), SearchModule (FTS seam), FeedModule (trending/discovery), and
    // SettingsModule. Placed after all of those (its dependencies).
    RetrievalModule,
    // Monetization Platform (AF5): entitlements (the single source of truth for premium
    // access), subscriptions, billing behind a replaceable payment provider port, AI
    // usage/credit metering, purchases, pricing, promotions. Additive-only; reuses the
    // settings feature-flag gate, notifications/analytics/audit, the global CacheService,
    // and BullMQ. @Global so it can provide the optional AI_USAGE_METER hook the AI
    // orchestrator delegates to (no reverse dependency on AiModule).
    MonetizationModule,
    // Collaboration, Publishing & Trust Platform (AF6). The Policy Engine is the
    // SINGLE SOURCE OF TRUTH for authorization: every collaborative/publishing/
    // moderation write is authorized through it. PolicyModule (@Global) is the
    // keystone; Trust + Collaboration self-register their data ports with it at
    // bootstrap (no cycles); PolicyIntegrationModule plugs in the entitlement
    // (AF5) + feature-flag (Settings) inputs. Reuses pieces (story lifecycle),
    // audit, notifications, and the PBAC PermissionResolver — no duplication.
    PolicyModule,
    TrustModule,
    CollaborationModule,
    PublishingModule,
    PolicyIntegrationModule,
    // Async processing backbone (E11): queues, workers, scheduler, cache,
    // monitoring. @Global — imported last so the business modules it wraps are
    // already defined; it reaches them via their exported services only.
    InfrastructureModule,
  ],
})
export class AppModule {}
