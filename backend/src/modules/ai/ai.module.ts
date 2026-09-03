import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';

import { AiFeatureService } from './ai-feature.service';
import { AiConfigService } from './config/ai-config.service';
import { AiConfigOverride } from './config/entities/ai-config-override.entity';
import { AiOrgConfig } from './config/entities/ai-org-config.entity';
import { AdminAiController } from './controllers/admin-ai.controller';
import { AiController } from './controllers/ai.controller';
import { AiConversation } from './conversations/entities/ai-conversation.entity';
import { AiMessage } from './conversations/entities/ai-message.entity';
import { AI_CONTEXT_PROVIDERS } from './context/context-builder.port';
import { ContextRegistryService } from './context/context-registry.service';
import { SelectionContextBuilder } from './context/builders/selection-context.builder';
import { WritingMetadataContextBuilder } from './context/builders/writing-metadata-context.builder';
import { AiCompletionService } from './orchestration/ai-completion.service';
import { AiPromptTemplate } from './prompts/entities/ai-prompt-template.entity';
import { PromptRegistryService } from './prompts/prompt-registry.service';
import { AI_PROVIDER_ADAPTERS } from './providers/ai-provider.port';
import { AnthropicAdapter } from './providers/adapters/anthropic.adapter';
import { GeminiAdapter } from './providers/adapters/gemini.adapter';
import { OpenAiAdapter } from './providers/adapters/openai.adapter';
import { StubAdapter } from './providers/adapters/stub.adapter';
import { ProviderRegistryService } from './providers/provider-registry.service';
import { AiModel } from './registry/entities/ai-model.entity';
import { ModelRegistryService } from './registry/model-registry.service';
import { InputLengthHook } from './safety/hooks/input-length.hook';
import { SanitizeHook } from './safety/hooks/sanitize.hook';
import { AI_SAFETY_HOOKS } from './safety/safety.types';
import { SafetyService } from './safety/safety.service';
import { AiUsageLog } from './tokens/entities/ai-usage-log.entity';
import { TokenCounterService } from './tokens/token-counter.service';
import { UsageService } from './tokens/usage.service';

/**
 * AI Platform module (AF1 — Phase 2 AI foundation). The reusable AI foundation
 * every future AI feature builds on: a provider abstraction (OpenAI/Anthropic/
 * Gemini adapters behind one port, extension points reserved), model + prompt
 * registries, a pluggable context pipeline, token accounting + usage limits,
 * layered configuration, safety hooks, and the completion orchestrator that
 * composes them all.
 *
 * D5 removed the conversation layer: with the free-form assistant and Ask My Book
 * gone, every surviving surface (Polish, Manuscript feedback, story analyses) is a
 * single stateless request, so completions no longer load or persist history. The
 * two entities stay registered until their drop migration lands.
 *
 * Additive-only (docs/25 freeze): new tables + new `/api/v1/ai/*` +
 * `/api/v1/admin/ai/*` endpoints, no change to any existing v1 contract. Feature
 * gating REUSES the settings feature-flag subsystem (`SettingsModule`). The
 * services below are exported so a future AI feature module reuses them and
 * registers its own context providers / safety hooks under the multi-tokens.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiModel,
      AiPromptTemplate,
      AiOrgConfig,
      AiConfigOverride,
      AiConversation,
      AiMessage,
      AiUsageLog,
    ]),
    AuthModule,
    SettingsModule,
    // B5 (docs/45 §4.10): the AI gate reads the caller's own "turn AI off" preference
    // from the users module's `SettingsService`. One-directional — `UsersModule`
    // imports only `TaxonomyModule`, so this adds no cycle.
    UsersModule,
  ],
  controllers: [AiController, AdminAiController],
  providers: [
    // Provider adapters (thin HTTP clients) + multi-token registry.
    OpenAiAdapter,
    AnthropicAdapter,
    GeminiAdapter,
    // The `stub` provider is registered like the rest and gated like the rest: it refuses every call
    // unless `AI_STUB_ENABLED=true` (see stub.adapter.ts). Registration is not exposure.
    StubAdapter,
    {
      provide: AI_PROVIDER_ADAPTERS,
      useFactory: (
        openai: OpenAiAdapter,
        anthropic: AnthropicAdapter,
        gemini: GeminiAdapter,
        stub: StubAdapter,
      ) => [openai, anthropic, gemini, stub],
      inject: [OpenAiAdapter, AnthropicAdapter, GeminiAdapter, StubAdapter],
    },
    ProviderRegistryService,
    // Registries + accounting.
    ModelRegistryService,
    PromptRegistryService,
    TokenCounterService,
    UsageService,
    // Configuration.
    AiConfigService,
    // Context pipeline (pluggable providers under the multi-token).
    SelectionContextBuilder,
    WritingMetadataContextBuilder,
    {
      provide: AI_CONTEXT_PROVIDERS,
      useFactory: (selection: SelectionContextBuilder, metadata: WritingMetadataContextBuilder) => [
        selection,
        metadata,
      ],
      inject: [SelectionContextBuilder, WritingMetadataContextBuilder],
    },
    ContextRegistryService,
    // Safety pipeline (default permissive hooks under the multi-token).
    InputLengthHook,
    SanitizeHook,
    {
      provide: AI_SAFETY_HOOKS,
      useFactory: (length: InputLengthHook, sanitize: SanitizeHook) => [length, sanitize],
      inject: [InputLengthHook, SanitizeHook],
    },
    SafetyService,
    // Gate + orchestrator.
    AiFeatureService,
    AiCompletionService,
  ],
  exports: [
    AiCompletionService,
    AiFeatureService,
    AiConfigService,
    ModelRegistryService,
    PromptRegistryService,
    ContextRegistryService,
    UsageService,
  ],
})
export class AiModule {}
