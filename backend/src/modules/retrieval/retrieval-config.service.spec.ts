import { RankingSignal, RetrievalSource } from '@qalam/shared';

import type { SettingsService } from '../settings';
import type { SettingsActor } from '../settings/settings.util';
import { DEFAULT_RETRIEVAL_CONFIG, RETRIEVAL_SETTING_KEYS } from './retrieval.constants';
import { RetrievalConfigService } from './retrieval-config.service';

/**
 * The admin-tunable retrieval config (AF4) — the read A3's editor renders and the write it saves.
 *
 * Two behaviours are load-bearing and had no coverage before A3 (A3-4). First, the read is the
 * DEFENSIVE layer: the value is one free-form JSON settings row, so it can be partial, stale, or
 * hand-edited, and what comes out of it is handed straight to the planner. Second, the write is a
 * PATCH that merges per key and never prunes — so whatever a bad member does, it does forever.
 */

function build(stored: unknown) {
  const settings = {
    getValue: jest.fn().mockResolvedValue(stored),
    updateSettings: jest.fn().mockResolvedValue([]),
  };
  return {
    service: new RetrievalConfigService(settings as unknown as SettingsService),
    settings,
  };
}

const actor: SettingsActor = { id: 'admin-1', role: 'admin' } as SettingsActor;

describe('RetrievalConfigService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('getConfig', () => {
    it('returns the compiled defaults when the setting has never been written', async () => {
      const { service } = build(null);

      await expect(service.getConfig()).resolves.toEqual(DEFAULT_RETRIEVAL_CONFIG);
    });

    it('falls back to defaults when the settings subsystem is unavailable', async () => {
      const settings = { getValue: jest.fn().mockRejectedValue(new Error('redis down')) };
      const service = new RetrievalConfigService(settings as unknown as SettingsService);

      await expect(service.getConfig()).resolves.toEqual(DEFAULT_RETRIEVAL_CONFIG);
    });

    it('merges a partial stored value over the defaults', async () => {
      const { service } = build({ topK: 3 });

      const config = await service.getConfig();

      expect(config.topK).toBe(3);
      expect(config.timeoutMs).toBe(DEFAULT_RETRIEVAL_CONFIG.timeoutMs);
      expect(config.rankingWeights).toEqual(DEFAULT_RETRIEVAL_CONFIG.rankingWeights);
    });

    /**
     * Every deployment seeded before D5 has `synthesisEnabled` in its stored row. The merge
     * keeps only keys the compiled default knows, so the stale key is dropped rather than
     * handed to the planner as a resurrected knob.
     */
    it('drops the retired synthesisEnabled key from a pre-D5 stored row', async () => {
      const { service } = build({ topK: 3, synthesisEnabled: true });

      const config = await service.getConfig();

      expect(config).not.toHaveProperty('synthesisEnabled');
      expect(config.topK).toBe(3);
    });

    it('keeps every source and signal key, so the editor renders a complete form', async () => {
      const { service } = build({ sources: { [RetrievalSource.Vector]: false } });

      const config = await service.getConfig();

      expect(Object.keys(config.sources).sort()).toEqual(Object.values(RetrievalSource).sort());
      expect(Object.keys(config.rankingWeights).sort()).toEqual(
        Object.values(RankingSignal).sort(),
      );
      expect(config.sources[RetrievalSource.Vector]).toBe(false);
    });

    it('drops a stored key that is not a known source or signal (A3-2)', async () => {
      const { service } = build({
        sources: { pigeon_post: true },
        rankingWeights: { vibes: 0.9 },
      });

      const config = await service.getConfig();

      expect(config.sources).not.toHaveProperty('pigeon_post');
      expect(config.rankingWeights).not.toHaveProperty('vibes');
    });

    it('falls back to a key default when a stored weight is not a usable number (A3-2)', async () => {
      // The planner reads weights as numbers without checking. A string fails `weight > 0`, so the
      // signal vanishes from ranking with nothing logged — the failure mode this guards.
      const { service } = build({
        rankingWeights: {
          [RankingSignal.GraphDistance]: 'heavy',
          [RankingSignal.Popularity]: 42,
          [RankingSignal.Freshness]: 0.75,
        },
      });

      const config = await service.getConfig();

      expect(config.rankingWeights[RankingSignal.GraphDistance]).toBe(
        DEFAULT_RETRIEVAL_CONFIG.rankingWeights[RankingSignal.GraphDistance],
      );
      expect(config.rankingWeights[RankingSignal.Popularity]).toBe(
        DEFAULT_RETRIEVAL_CONFIG.rankingWeights[RankingSignal.Popularity],
      );
      expect(config.rankingWeights[RankingSignal.Freshness]).toBe(0.75);
    });

    it('falls back to defaults when the stored value is not an object at all', async () => {
      const { service } = build('nonsense');

      await expect(service.getConfig()).resolves.toEqual(DEFAULT_RETRIEVAL_CONFIG);
    });
  });

  describe('update', () => {
    it('writes the merged config through the audited settings path', async () => {
      const { service, settings } = build({ topK: 5 });

      const next = await service.update({ topK: 7 }, actor);

      expect(next.topK).toBe(7);
      expect(settings.updateSettings).toHaveBeenCalledWith(
        [{ key: RETRIEVAL_SETTING_KEYS.Config, value: next }],
        actor,
        'Update AI retrieval config',
      );
    });

    it('merges tables per key rather than replacing them', async () => {
      const { service } = build(null);

      const next = await service.update(
        { rankingWeights: { [RankingSignal.Freshness]: 0.9 } },
        actor,
      );

      expect(next.rankingWeights[RankingSignal.Freshness]).toBe(0.9);
      expect(next.rankingWeights[RankingSignal.SemanticSimilarity]).toBe(
        DEFAULT_RETRIEVAL_CONFIG.rankingWeights[RankingSignal.SemanticSimilarity],
      );
      expect(next.sources).toEqual(DEFAULT_RETRIEVAL_CONFIG.sources);
    });

    it('accepts 0 as a weight — falsy, and it means "disable this signal"', async () => {
      const { service } = build(null);

      const next = await service.update(
        { rankingWeights: { [RankingSignal.Popularity]: 0 } },
        actor,
      );

      expect(next.rankingWeights[RankingSignal.Popularity]).toBe(0);
    });

    it('accepts `false` for a source toggle', async () => {
      const { service } = build(null);

      const next = await service.update({ sources: { [RetrievalSource.Vector]: false } }, actor);

      expect(next.sources[RetrievalSource.Vector]).toBe(false);
      expect(next.sources[RetrievalSource.Keyword]).toBe(true);
    });
  });
});
