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
    it('drops the Ask My Book flag — the surface it dark-launched no longer exists', () => {
      expect(FEATURE_FLAG_DEFINITIONS.find((f) => f.key === 'feature.ai.askBook.enabled')).toBe(
        undefined,
      );
      expect(FLAGGED_AI_FEATURES).not.toContain(AiFeature.AskBook);
    });

    /**
     * Search and recommendations are ordinary product surfaces now: the server stopped
     * consulting these flags in D5's first phase. Their rows survive on purpose — mobile's
     * `AiFeatures.isEnabled` treats an ABSENT flag as off, so deleting them here would take
     * mobile's search screen dark against a server that answers it happily. They go when the
     * client halves land. See the warning on `FLAGGED_AI_FEATURES`.
     */
    it.each(['feature.ai.semanticSearch.enabled', 'feature.ai.recommendations.enabled'])(
      'keeps %s seeded for the clients, though the server no longer reads it',
      (key) => {
        expect(FEATURE_FLAG_DEFINITIONS.find((f) => f.key === key)).toBeDefined();
      },
    );
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
