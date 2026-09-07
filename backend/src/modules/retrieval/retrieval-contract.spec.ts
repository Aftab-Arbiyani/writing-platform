import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AiFeature, FLAGGED_AI_FEATURES } from '@qalam/shared';

import { AI_PROMPT_CATALOG } from '../ai/prompts/prompt-catalog';
import { FEATURE_FLAG_DEFINITIONS } from '../settings/settings.catalog';

/**
 * The AF4 contract, restated for D5.
 *
 * This file used to pin the opposite of what it pins now: that `ask_book.answer`,
 * `semantic_search.answer` and `recommendations.explain` were registered, that `AskBook` was
 * a flagged feature, and that intents mapped to prompt keys. All of that described a
 * retrieval platform with an LLM inside it.
 *
 * D5 removed the LLM. Ask My Book is gone entirely and search's optional grounded synthesis
 * with it, which leaves retrieval as deterministic composition over the knowledge graph, the
 * FTS engine and metadata. That is a claim worth guarding, because it is easy to undo one
 * import at a time — so the assertions below are absences, and the last one is structural.
 */
describe('AF4 shared contract (post-D5: retrieval calls no LLM)', () => {
  describe('prompt catalogue', () => {
    it.each(['ask_book.answer', 'semantic_search.answer', 'recommendations.explain'])(
      'no longer registers %s',
      (key) => {
        expect(AI_PROMPT_CATALOG.find((e) => e.key === key)).toBeUndefined();
      },
    );

    /**
     * The general form of the three cases above: a prompt template exists to be sent to a
     * model, so ANY template owned by a retrieval surface would mean an LLM had come back.
     */
    it('registers no template for any retrieval surface', () => {
      const retrievalOwned = AI_PROMPT_CATALOG.filter((e) =>
        ['ask_book.', 'semantic_search.', 'recommendations.', 'explorer.'].some((prefix) =>
          e.key.startsWith(prefix),
        ),
      );
      expect(retrievalOwned).toEqual([]);
    });
  });

  describe('feature flags', () => {
    /**
     * D5 retired six per-feature AI flags, in two steps that were forced apart.
     *
     * `askBook` went in B2 with its routes. `semanticSearch` and `recommendations` had to
     * WAIT, even though the server had already stopped consulting them: mobile's
     * `AiFeatures.isEnabled` reads an ABSENT flag as OFF, so deleting the rows while mobile
     * still read them would have taken its search screen dark against a server answering
     * happily. The client halves landed first (web F1, mobile M2), and the vocabulary
     * contract then removed the rows — along with `grammar`, `rewrite` and `summarization`,
     * which were never built at all. See the warning on `FLAGGED_AI_FEATURES`.
     */
    it.each([
      'feature.ai.askBook.enabled',
      'feature.ai.semanticSearch.enabled',
      'feature.ai.recommendations.enabled',
      'feature.ai.grammar.enabled',
      'feature.ai.rewrite.enabled',
      'feature.ai.summarization.enabled',
    ])('no longer defines %s', (key) => {
      expect(FEATURE_FLAG_DEFINITIONS.find((f) => f.key === key)).toBeUndefined();
    });

    it('still flags every AI feature that survived', () => {
      expect([...FLAGGED_AI_FEATURES].sort()).toEqual(
        [
          AiFeature.WritingAssistant,
          AiFeature.CraftCoach,
          AiFeature.CharacterAnalysis,
          AiFeature.PlotAnalysis,
          AiFeature.WorldBuilding,
          AiFeature.StyleAnalysis,
          AiFeature.StoryTimeline,
          AiFeature.Moderation,
        ].sort(),
      );
    });
  });

  /**
   * The structural assertion, and the one that actually holds the line: the retrieval module
   * does not import the AI platform. Every behavioural test above could keep passing while
   * someone wired a model back into a retriever or a ranker; this cannot.
   */
  describe('module boundary', () => {
    it('the retrieval module does not depend on the AI platform', () => {
      const source = readFileSync(resolve(__dirname, 'retrieval.module.ts'), 'utf8');
      const imports = source
        .split('\n')
        .filter((line) => line.startsWith('import ') || line.startsWith("} from '"));
      expect(imports.filter((line) => line.includes("'../ai"))).toEqual([]);
    });
  });
});
