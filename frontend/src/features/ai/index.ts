/**
 * AI feature barrel (AF1). Exposes the reusable AI data layer — hooks, the api
 * layer, and the streaming store — that any future AI feature (grammar, rewrite,
 * craft-coach, …) composes. AF1 ships no end-user screens; this is the foundation
 * those features build on.
 */
export { aiApi } from './api/ai.api';
export { useAiStreamStore } from './stores/ai-stream.store';
export type { AiStreamStatus } from './stores/ai-stream.store';
export { useAiConfig, useUpdateAiConfig } from './hooks/use-ai-config';
export { useAiFeatures, useAiModels, useAiUsage } from './hooks/use-ai-meta';
export {
  useAiConversation,
  useAiConversations,
  useCreateConversation,
  useDeleteConversation,
} from './hooks/use-ai-conversations';
export { useAiCompletion, useAiStream } from './hooks/use-ai-completion';
export type * from './types/ai.types';
