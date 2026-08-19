import { RankingSignal, RetrievalSource } from '@qalam/shared';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { UpdateRetrievalConfigDto } from './retrieval-request.dto';

/**
 * What `PUT /admin/ai/search-config` accepts into the `ai.retrieval.config` settings row (A3-2).
 *
 * Before A3 the two tables carried `@IsObject()` and nothing else, and the settings layer validates a
 * `json` value only as "an object" — so any key with any value reached the stored config and stayed
 * there, because `update` merges per key and never prunes. The damage is quiet rather than loud: the
 * planner filters signals with `weight > 0`, and a non-numeric weight fails that comparison, so the
 * signal drops out of ranking with no error on any layer.
 *
 * Asserted against a DTO instance built the way `main.ts` builds one (`whitelist`,
 * `forbidNonWhitelisted`, implicit conversion OFF), so a payload that survives here is one the
 * service will actually see. Same shape as the monetization config-table spec (B8, A1-2).
 */

function received(payload: Record<string, unknown>): UpdateRetrievalConfigDto {
  return plainToInstance(UpdateRetrievalConfigDto, payload, { enableImplicitConversion: false });
}

function errorsOn(payload: Record<string, unknown>): string[] {
  return validateSync(received(payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((error) => error.property);
}

describe('UpdateRetrievalConfigDto', () => {
  describe('the scalar knobs', () => {
    it('accepts a full, in-range patch', () => {
      expect(
        errorsOn({
          topK: 10,
          candidatesPerSource: 40,
          contextTokens: 2000,
          timeoutMs: 8000,
          synthesisEnabled: true,
        }),
      ).toEqual([]);
    });

    it('accepts an empty patch — every field is optional', () => {
      expect(errorsOn({})).toEqual([]);
    });

    it('rejects a topK below the floor and a timeout above the ceiling', () => {
      expect(errorsOn({ topK: 0 })).toEqual(['topK']);
      expect(errorsOn({ timeoutMs: 60_001 })).toEqual(['timeoutMs']);
    });

    it('rejects an unknown property instead of silently dropping it', () => {
      expect(errorsOn({ nonsense: 1 })).toEqual(['nonsense']);
    });
  });

  describe('sources (A3-2)', () => {
    it('accepts known sources mapped to booleans', () => {
      expect(
        errorsOn({
          sources: { [RetrievalSource.KnowledgeGraph]: true, [RetrievalSource.Vector]: false },
        }),
      ).toEqual([]);
    });

    it('rejects an unknown source key — it would persist in the config forever', () => {
      expect(errorsOn({ sources: { pigeon_post: true } })).toEqual(['sources']);
    });

    it('rejects a non-boolean toggle', () => {
      expect(errorsOn({ sources: { [RetrievalSource.Keyword]: 'yes' } })).toEqual(['sources']);
    });
  });

  describe('rankingWeights (A3-2)', () => {
    it('accepts known signals weighted within 0..1, including 0 to disable one', () => {
      expect(
        errorsOn({
          rankingWeights: {
            [RankingSignal.SemanticSimilarity]: 1,
            [RankingSignal.Freshness]: 0.2,
            [RankingSignal.Popularity]: 0,
          },
        }),
      ).toEqual([]);
    });

    it('rejects an unknown signal key', () => {
      expect(errorsOn({ rankingWeights: { vibes: 0.5 } })).toEqual(['rankingWeights']);
    });

    it('rejects a weight the documented range never allowed', () => {
      expect(errorsOn({ rankingWeights: { [RankingSignal.Popularity]: 999 } })).toEqual([
        'rankingWeights',
      ]);
      expect(errorsOn({ rankingWeights: { [RankingSignal.Popularity]: -1 } })).toEqual([
        'rankingWeights',
      ]);
    });

    it('rejects a non-numeric weight — the planner would drop the signal in silence', () => {
      expect(errorsOn({ rankingWeights: { [RankingSignal.GraphDistance]: '0.5' } })).toEqual([
        'rankingWeights',
      ]);
      expect(errorsOn({ rankingWeights: { [RankingSignal.GraphDistance]: null } })).toEqual([
        'rankingWeights',
      ]);
    });
  });
});
