import type { AiConversationSummary } from '@qalam/api-types';

/**
 * Display helpers for conversation rows (W8 C1). Kept out of the pages so both the list and the
 * detail view render a conversation's identity identically — a title that differs between the two is
 * how a reader ends up unsure they opened the row they clicked.
 */

/**
 * A human title, falling back to a stable placeholder when the server has none.
 *
 * `title` is genuinely nullable — `POST /ai/conversations` takes it as optional and stores `null`
 * (`conversation.repository.ts:35`) — so this fallback is the common case, not an edge one. Mirrors
 * mobile's `AiConversationSummary.displayTitle` (`ai_conversation.dart:76-79`), including its wording,
 * so screenshots of the two clients agree.
 */
export function conversationTitle(conversation: Pick<AiConversationSummary, 'title'>): string {
  const trimmed = conversation.title?.trim() ?? '';
  return trimmed === '' ? 'Untitled conversation' : trimmed;
}

/**
 * Human label for an `AiFeature`.
 *
 * Deliberately NOT imported from monetization's `featureLabel`: features may not import features
 * (docs/26 §4), and the two label different vocabularies — that one names premium *entitlement*
 * features, this one names AI *capability* features. The overlap in wording is a coincidence, not a
 * shared source.
 *
 * Unknown values are de-snake-cased rather than dropped: the server may add a feature before this
 * client knows about it, and `world_building` reading as "World building" is right even when
 * unlisted.
 */
const FEATURE_LABELS: Readonly<Record<string, string>> = {
  grammar: 'Grammar',
  rewrite: 'Rewrite',
  summarization: 'Summarization',
  craft_coach: 'Craft Coach',
  writing_assistant: 'Writing assistant',
  character_analysis: 'Character analysis',
  plot_analysis: 'Plot analysis',
  world_building: 'World building',
  style_analysis: 'Style analysis',
  story_timeline: 'Story timeline',
  semantic_search: 'Semantic search',
  recommendations: 'Recommendations',
  ask_book: 'Ask my book',
};

export function featureLabel(feature: string): string {
  const known = FEATURE_LABELS[feature];
  if (known !== undefined) return known;
  const spaced = feature.replaceAll('_', ' ').trim();
  return spaced === '' ? 'AI' : spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Human label for a message role (`AiMessageRole` — user/assistant/system/tool). */
export function roleLabel(role: string): string {
  switch (role) {
    case 'user':
      return 'You';
    case 'assistant':
      return 'Assistant';
    case 'system':
      return 'System';
    case 'tool':
      return 'Tool';
    default:
      return 'Message';
  }
}
