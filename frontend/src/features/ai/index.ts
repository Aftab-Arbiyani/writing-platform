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
  useExportConversation,
  useRenameConversation,
} from './hooks/use-ai-conversations';

// W8 — the three remaining AI surfaces (docs/45 §4, row W8), mounted under `/settings/ai`.
export { AiHubPage } from './pages/ai-hub-page';
export { AiConversationsPage } from './pages/ai-conversations-page';
export { AiConversationPage } from './pages/ai-conversation-page';
export { PromptLibraryPage } from './pages/prompt-library-page';
export { AiUsagePage } from './pages/ai-usage-page';
export { BUILT_IN_PROMPT_PRESETS, PROMPT_HISTORY_CAP, presetKindLabel } from './lib/prompt-presets';
export type { PromptPreset, PromptPresetKind } from './lib/prompt-presets';
export { usePromptLibraryStore } from './stores/prompt-library.store';
export {
  ASSISTANT_CONVERSATION_PARAM,
  useAssistantConversation,
} from './hooks/use-assistant-conversation';
export { conversationTitle, featureLabel, roleLabel } from './lib/conversation-labels';
export {
  downloadConversationExport,
  exportFilename,
  serializeExport,
} from './lib/conversation-export';
export { useAiCompletion, useAiStream } from './hooks/use-ai-completion';

// W9 — the two STORY-scoped AF4 consumers (docs/45 §4, row W9), mounted as tabs on the in-editor
// panel above. No route of their own: both are per-story and reached from the editor, matching
// mobile's AI overflow menu (docs/48 §4.1).
export { storyRetrievalApi } from './api/story-retrieval.api';
export { useStoryExplorer, useExplorerAvailability } from './hooks/use-story-explorer';
export { useAskBook } from './hooks/use-ask-book';
export { useAskBookStore } from './stores/ask-book.store';
export { EXPLORER_VIEWS, explorerViewSpec, nodeTypeLabel } from './lib/explorer-views';
export type { ExplorerViewSpec } from './lib/explorer-views';
export { ASK_SCOPES } from './lib/ask-scopes';

export type * from './types/ai.types';
