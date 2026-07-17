/**
 * AI Platform module barrel (AF1). Re-exports the module + the services and ports
 * a future AI feature module reuses (the orchestrator, gate, registries, config,
 * usage, conversations) and the extension tokens it registers against.
 */
export { AiModule } from './ai.module';
export { AiCompletionService } from './orchestration/ai-completion.service';
export type {
  CompletionInput,
  CompletionOutput,
  CompletionStreamEvent,
} from './orchestration/ai-completion.service';
export { AiFeatureService } from './ai-feature.service';
export { AiConfigService } from './config/ai-config.service';
export { ModelRegistryService } from './registry/model-registry.service';
export { PromptRegistryService } from './prompts/prompt-registry.service';
export { ContextRegistryService } from './context/context-registry.service';
export { ConversationService } from './conversations/conversation.service';
export { UsageService } from './tokens/usage.service';
export { AI_CONTEXT_PROVIDERS } from './context/context-builder.port';
export type { ContextProvider } from './context/context-builder.port';
export { AI_SAFETY_HOOKS } from './safety/safety.types';
export type { SafetyHook } from './safety/safety.types';
export { AI_PROVIDER_ADAPTERS } from './providers/ai-provider.port';
export type { AiProviderAdapter } from './providers/ai-provider.port';
