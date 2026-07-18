import {
  AiFeature,
  aiFeatureFlagKey,
  askScopeNodeTypes,
  AskScope,
  FLAGGED_AI_FEATURES,
  RetrievalIntent,
  retrievalIntentFeature,
  retrievalPromptKey,
} from '@qalam/shared';

import { AI_PROMPT_CATALOG } from '../ai/prompts/prompt-catalog';
import { renderTemplate, validateTemplateBody } from '../ai/prompts/prompt-renderer';
import { FEATURE_FLAG_DEFINITIONS } from '../settings/settings.catalog';

const AF4_TEMPLATES = ['ask_book.answer', 'semantic_search.answer', 'recommendations.explain'];

describe('AF4 shared contract', () => {
  describe('vocabulary + helpers', () => {
    it('adds the AskBook feature and derives its flag key', () => {
      expect(AiFeature.AskBook).toBe('ask_book');
      expect(aiFeatureFlagKey(AiFeature.AskBook)).toBe('feature.ai.askBook.enabled');
      expect(FLAGGED_AI_FEATURES).toContain(AiFeature.AskBook);
    });

    it('maps intents to the right feature + prompt key', () => {
      expect(retrievalIntentFeature(RetrievalIntent.Ask)).toBe(AiFeature.AskBook);
      expect(retrievalPromptKey(RetrievalIntent.Ask)).toBe('ask_book.answer');
      expect(retrievalIntentFeature(RetrievalIntent.Search)).toBe(AiFeature.SemanticSearch);
      expect(retrievalPromptKey(RetrievalIntent.Search)).toBe('semantic_search.answer');
      expect(retrievalIntentFeature(RetrievalIntent.Recommend)).toBe(AiFeature.Recommendations);
    });

    it('maps ask scopes to graph node types', () => {
      expect(askScopeNodeTypes(AskScope.Timeline)).toEqual(['event']);
      expect(askScopeNodeTypes(AskScope.Character)).toContain('character');
    });
  });

  describe('prompt catalogue', () => {
    it('registers all AF4 templates with a declared {{context}} variable', () => {
      for (const key of AF4_TEMPLATES) {
        const entry = AI_PROMPT_CATALOG.find((e) => e.key === key);
        expect(entry).toBeDefined();
        expect(entry?.variables).toContain('context');
      }
    });

    it('every AF4 template body is boot-valid and renders (all {{vars}} declared)', () => {
      for (const key of AF4_TEMPLATES) {
        const entry = AI_PROMPT_CATALOG.find((e) => e.key === key);
        expect(() => validateTemplateBody(entry!.body, entry!.variables)).not.toThrow();
        const vars = Object.fromEntries(entry!.variables.map((v) => [v, 'x']));
        expect(renderTemplate(entry!.body, vars)).toContain('x');
      }
    });
  });

  describe('feature flags', () => {
    it('seeds the AF4 flags disabled', () => {
      for (const key of [
        'feature.ai.semanticSearch.enabled',
        'feature.ai.recommendations.enabled',
        'feature.ai.askBook.enabled',
      ]) {
        const flag = FEATURE_FLAG_DEFINITIONS.find((f) => f.key === key);
        expect(flag).toBeDefined();
        expect(flag?.enabled).toBe(false);
      }
    });
  });
});
