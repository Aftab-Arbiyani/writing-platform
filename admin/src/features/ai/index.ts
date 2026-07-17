/**
 * Admin AI feature barrel (AF1). Exposes the org-defaults page + the reusable AI
 * admin data layer (config/providers/models hooks). Per-feature AI ON/OFF flags
 * are managed through the existing Settings → Feature Flags surface.
 */
export { AiConfigPage } from './pages/ai-config-page';
export { useAiModels, useAiOrgConfig, useAiProviders, useUpdateAiOrgConfig } from './hooks/use-ai';
export { aiApi } from './api/ai.api';
