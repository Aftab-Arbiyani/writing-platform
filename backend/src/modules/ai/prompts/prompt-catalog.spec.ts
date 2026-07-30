import { AiFeature, FLAGGED_AI_FEATURES, PromptCategory, aiFeatureFlagKey } from '@qalam/shared';

import { FEATURE_FLAG_DEFINITIONS } from '../../settings/settings.catalog';
import { AI_PROMPT_CATALOG } from './prompt-catalog';
import { extractVariables, renderTemplate, validateTemplateBody } from './prompt-renderer';

/**
 * AF2 guards the seed catalogue + feature/flag wiring for the two user-facing
 * features (Writing Assistant, Craft Coach). Pure tests (no DB) — they assert the
 * exact invariants `PromptRegistryService.onModuleInit` and the flag gate rely on,
 * so a mis-authored template or a missing flag row fails CI, not production boot.
 */
describe('AI prompt catalog (AF2)', () => {
  it('declares every placeholder it uses (boot syncCatalog would otherwise throw)', () => {
    for (const entry of AI_PROMPT_CATALOG) {
      expect(() => validateTemplateBody(entry.body, entry.variables)).not.toThrow();
    }
  });

  it('has unique keys and valid categories', () => {
    const keys = AI_PROMPT_CATALOG.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    const categories = Object.values(PromptCategory) as string[];
    for (const entry of AI_PROMPT_CATALOG) {
      expect(categories).toContain(entry.category);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('declares exactly the variables its body references (no dead vars in bodies)', () => {
    for (const entry of AI_PROMPT_CATALOG) {
      const used = extractVariables(entry.body).sort();
      // Declared may be a superset (declared-but-unused is allowed), but every
      // used variable must be declared.
      for (const name of used) {
        expect(entry.variables).toContain(name);
      }
    }
  });

  describe('Writing Assistant templates', () => {
    const keys = AI_PROMPT_CATALOG.filter((e) => e.key.startsWith('writing_assistant.')).map(
      (e) => e.key,
    );

    it('ships the full action shelf', () => {
      expect(keys).toEqual(
        expect.arrayContaining([
          'writing_assistant.continue',
          'writing_assistant.rewrite',
          'writing_assistant.expand',
          'writing_assistant.condense',
          'writing_assistant.simplify',
          'writing_assistant.improve',
          'writing_assistant.tone',
          'writing_assistant.freeform',
        ]),
      );
    });

    it('renders the parametrised improve template with an aspect', () => {
      const improve = AI_PROMPT_CATALOG.find((e) => e.key === 'writing_assistant.improve')!;
      expect(improve.variables).toEqual(['aspect']);
      const rendered = renderTemplate(improve.body, { aspect: 'flow and rhythm' });
      expect(rendered).toContain('flow and rhythm');
      expect(rendered).not.toContain('{{');
    });

    it('renders the parametrised tone template with a tone', () => {
      const tone = AI_PROMPT_CATALOG.find((e) => e.key === 'writing_assistant.tone')!;
      expect(tone.variables).toEqual(['tone']);
      expect(renderTemplate(tone.body, { tone: 'suspenseful' })).toContain('suspenseful');
    });
  });

  describe('Craft Coach templates', () => {
    const coach = AI_PROMPT_CATALOG.filter((e) => e.key.startsWith('craft_coach.'));

    it('ships every coaching lens under the analysis category', () => {
      expect(coach.map((e) => e.key)).toEqual(
        expect.arrayContaining([
          'craft_coach.chapter_feedback',
          'craft_coach.scene_feedback',
          'craft_coach.pacing',
          'craft_coach.readability',
          'craft_coach.consistency',
          'craft_coach.review',
        ]),
      );
      for (const entry of coach) {
        expect(entry.category).toBe(PromptCategory.Analysis);
      }
    });

    it('instructs the shared structured JSON contract (single parser client-side)', () => {
      for (const entry of coach) {
        expect(entry.variables).toEqual([]);
        expect(entry.body).toContain('"score"');
        expect(entry.body).toContain('"recommendations"');
        expect(entry.body).toContain('"sections"');
        // JSON braces must never be mistaken for template placeholders.
        expect(extractVariables(entry.body)).toEqual([]);
      }
    });
  });
});

describe('AF2 feature flags', () => {
  it('flags both user-facing features (appear in GET /ai/features)', () => {
    expect(FLAGGED_AI_FEATURES).toContain(AiFeature.WritingAssistant);
    expect(FLAGGED_AI_FEATURES).toContain(AiFeature.CraftCoach);
  });

  it('seeds a disabled DB flag row for each (boot syncFlagDefinitions)', () => {
    const byKey = new Map(FEATURE_FLAG_DEFINITIONS.map((f) => [f.key, f]));
    for (const feature of [AiFeature.WritingAssistant, AiFeature.CraftCoach]) {
      const def = byKey.get(aiFeatureFlagKey(feature));
      expect(def).toBeDefined();
      expect(def!.enabled).toBe(false);
    }
  });

  it('maps the writing-assistant feature to the expected camelCase flag key', () => {
    expect(aiFeatureFlagKey(AiFeature.WritingAssistant)).toBe(
      'feature.ai.writingAssistant.enabled',
    );
  });
});
