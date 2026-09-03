/**
 * Writing tools barrel (AF1 data layer + the three D5 surfaces).
 *
 * AF1 shipped the reusable data layer — hooks, the api layer, and the streaming store. On top of it
 * sit exactly three writer-facing tools, all reached from the in-editor drawer that
 * `app/routes/write.tsx` mounts: **Polish**, **Manuscript feedback** and **Story Map**.
 *
 * **There are no routes in this feature.** D5 removed the five that existed — the `/settings/ai` hub,
 * the conversations list and detail, the prompt library, and the token-usage page — along with Ask My
 * Book. Everything a writer can do here now happens beside their draft, which is the only place any
 * of it was ever useful.
 */
export { WritingToolsDrawer } from './components/writing-tools-drawer';
export { ModelDisclosureNote } from './components/model-disclosure-note';
export { usePolishSession } from './hooks/use-polish-session';
export { useCraftCoach } from './hooks/use-craft-coach';
export { parseCoachReport } from './lib/coach-report';
export type { CoachReport, CoachSection } from './lib/coach-report';
export { COACH_TOOLS } from './lib/coach-tools';
export type { CoachTool } from './lib/coach-tools';
export { aiApi } from './api/ai.api';
export { useAiStreamStore } from './stores/ai-stream.store';
export type { AiStreamStatus } from './stores/ai-stream.store';
export { useAiFeatures, useAiModels } from './hooks/use-ai-meta';
export { useAiCompletion, useAiStream } from './hooks/use-ai-completion';

// Story Map — the AF3 graph, projected. No route of its own: it is per-story and reached from the
// editor, matching mobile's arrangement (docs/48 §4.1).
export { storyRetrievalApi } from './api/story-retrieval.api';
export { useStoryExplorer, useExplorerAvailability, useMapStory } from './hooks/use-story-explorer';
export { EXPLORER_VIEWS, explorerViewSpec, nodeTypeLabel } from './lib/explorer-views';
export type { ExplorerViewSpec } from './lib/explorer-views';

export type * from './types/ai.types';
