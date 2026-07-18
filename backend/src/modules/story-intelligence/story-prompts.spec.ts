import {
  AiFeature,
  FLAGGED_AI_FEATURES,
  PromptCategory,
  StoryAnalysisKind,
  aiFeatureFlagKey,
  normalizeStoryName,
  storyAnalysisFeature,
  storyAnalysisPromptKey,
} from '@qalam/shared';

import { AI_PROMPT_CATALOG } from '../ai/prompts/prompt-catalog';
import { renderTemplate, validateTemplateBody } from '../ai/prompts/prompt-renderer';
import { FEATURE_FLAG_DEFINITIONS } from '../settings/settings.catalog';

describe('Story Intelligence prompt templates (AF3)', () => {
  const kinds = Object.values(StoryAnalysisKind);

  it('ships a story.<kind> template for every analysis kind', () => {
    const keys = AI_PROMPT_CATALOG.filter((e) => e.key.startsWith('story.')).map((e) => e.key);
    for (const kind of kinds) {
      expect(keys).toContain(storyAnalysisPromptKey(kind));
    }
  });

  it('every story template is analysis-category, {{scope}}-parametrised, and renders', () => {
    for (const kind of kinds) {
      const entry = AI_PROMPT_CATALOG.find((e) => e.key === storyAnalysisPromptKey(kind));
      expect(entry).toBeDefined();
      expect(entry?.category).toBe(PromptCategory.Analysis);
      expect(entry?.variables).toEqual(['scope']);
      // Declared placeholders are valid and render without throwing.
      expect(() => validateTemplateBody(entry!.body, entry!.variables)).not.toThrow();
      const rendered = renderTemplate(entry!.body, { scope: 'chapter' });
      expect(rendered).toContain('chapter');
      expect(rendered).not.toContain('{{');
      // Structured-JSON contract markers (never plain text).
      expect(entry!.body).toContain('"summary"');
      expect(entry!.body).toContain('"confidence"');
      expect(entry!.body).toContain('"evidence"');
    }
  });

  it('maps each kind to the gating AI feature', () => {
    expect(storyAnalysisFeature(StoryAnalysisKind.Character)).toBe(AiFeature.CharacterAnalysis);
    expect(storyAnalysisFeature(StoryAnalysisKind.Plot)).toBe(AiFeature.PlotAnalysis);
    expect(storyAnalysisFeature(StoryAnalysisKind.World)).toBe(AiFeature.WorldBuilding);
    expect(storyAnalysisFeature(StoryAnalysisKind.Style)).toBe(AiFeature.StyleAnalysis);
    expect(storyAnalysisFeature(StoryAnalysisKind.Timeline)).toBe(AiFeature.StoryTimeline);
  });
});

describe('AF3 feature flags', () => {
  const byKey = new Map(FEATURE_FLAG_DEFINITIONS.map((f) => [f.key, f]));

  it('flags every analysis feature (appears in GET /ai/features)', () => {
    for (const kind of Object.values(StoryAnalysisKind)) {
      expect(FLAGGED_AI_FEATURES).toContain(storyAnalysisFeature(kind));
    }
  });

  it('seeds a disabled DB flag row for the three new AF3 features', () => {
    for (const feature of [
      AiFeature.WorldBuilding,
      AiFeature.StyleAnalysis,
      AiFeature.StoryTimeline,
    ]) {
      const def = byKey.get(aiFeatureFlagKey(feature));
      expect(def).toBeDefined();
      expect(def?.enabled).toBe(false);
    }
  });
});

describe('normalizeStoryName', () => {
  it('folds case and whitespace for idempotent node dedupe', () => {
    expect(normalizeStoryName('  The   Wanderer ')).toBe('the wanderer');
    expect(normalizeStoryName('ARIA')).toBe('aria');
  });
});
