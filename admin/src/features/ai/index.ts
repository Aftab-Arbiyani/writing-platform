/**
 * Admin AI feature barrel (AF1 + AF4). Exposes the org-defaults page, the retrieval config editor
 * and search-analytics dashboard (A3), and the reusable AI admin data layer. Per-feature AI ON/OFF
 * flags are managed through the existing Settings → Feature Flags surface.
 */
export { AiConfigPage } from './pages/ai-config-page';
export { SearchAnalyticsPage } from './pages/search-analytics-page';
export { SearchConfigPage } from './pages/search-config-page';
export {
  useAiModels,
  useAiOrgConfig,
  useAiProviders,
  useRetrievalConfig,
  useSearchAnalytics,
  useUpdateAiOrgConfig,
  useUpdateRetrievalConfig,
} from './hooks/use-ai';
export { aiApi } from './api/ai.api';
