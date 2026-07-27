/**
 * AI feature barrel (AF1 data layer + AF2 surfaces).
 *
 * AF1 shipped the reusable data layer — hooks, the api layer, and the streaming store — with no
 * end-user screens. W2/AF2 adds the first of those screens: the in-editor Writing Assistant and
 * Craft Coach panel, mounted by the app-level `/write` route (docs/45 §4.2).
 */
export { WritingAssistantPanel } from './components/writing-assistant-panel';
export { useAssistantSession } from './hooks/use-assistant-session';
export { useCraftCoach } from './hooks/use-craft-coach';
export { parseCoachReport } from './lib/coach-report';
export type { CoachReport, CoachSection } from './lib/coach-report';
export { COACH_TOOLS } from './lib/coach-tools';
export type { CoachTool } from './lib/coach-tools';
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
