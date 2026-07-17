import { PromptCategory } from '@qalam/shared';

/** A seed prompt template (v1 of its key). */
export interface PromptCatalogEntry {
  key: string;
  category: PromptCategory;
  description: string;
  body: string;
  variables: string[];
}

/**
 * The seed prompt catalogue (AF1) — infra-level templates only (NO product
 * feature prompts; grammar/rewrite/etc. ship their templates when those features
 * are built). Source of truth for v1; the registry upserts these and admins can
 * add versions. Demonstrates the variable + rendering mechanism the whole
 * platform reuses.
 */
export const AI_PROMPT_CATALOG: readonly PromptCatalogEntry[] = [
  {
    key: 'system.base',
    category: PromptCategory.System,
    description: 'Baseline system prompt establishing the assistant persona.',
    body:
      'You are a helpful, precise writing assistant for the Qalam platform, a home for ' +
      'Hindi and Urdu writers. Respond in the language of the request. Be concise unless ' +
      'asked to elaborate.',
    variables: [],
  },
  {
    key: 'playground.freeform',
    category: PromptCategory.Conversation,
    description: 'Generic passthrough used by the infra playground / prompt testing.',
    body: '{{input}}',
    variables: ['input'],
  },
];
