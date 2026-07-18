import { Injectable, Logger } from '@nestjs/common';
import { RankingSignal, RetrievalSource } from '@qalam/shared';

import { SettingsService } from '../settings';
import type { SettingsActor } from '../settings/settings.util';
import { DEFAULT_RETRIEVAL_CONFIG, RETRIEVAL_SETTING_KEYS } from './retrieval.constants';
import type { ResolvedRetrievalConfig, RetrievalConfigPatch } from './retrieval.types';

/**
 * Resolves the admin-tunable retrieval config (AF4). The effective config is the seeded
 * `ai.retrieval.config` JSON setting merged defensively over compiled defaults, so a
 * missing/partial/legacy value never breaks retrieval. Reads reuse the Settings subsystem
 * (Redis-cached); writes go through the AUDITED settings write path — no bespoke config
 * store, no duplicated admin plumbing. This is the "Search/Ranking/Recommendation
 * Configuration" admin surface backed by the existing settings feature.
 */
@Injectable()
export class RetrievalConfigService {
  private readonly logger = new Logger(RetrievalConfigService.name);

  constructor(private readonly settings: SettingsService) {}

  async getConfig(): Promise<ResolvedRetrievalConfig> {
    try {
      const raw = await this.settings.getValue(RETRIEVAL_SETTING_KEYS.Config);
      return mergeConfig(raw);
    } catch (error) {
      this.logger.warn(`retrieval config unavailable, using defaults: ${(error as Error).message}`);
      return DEFAULT_RETRIEVAL_CONFIG;
    }
  }

  async update(
    patch: RetrievalConfigPatch,
    actor: SettingsActor,
  ): Promise<ResolvedRetrievalConfig> {
    const current = await this.getConfig();
    const next: ResolvedRetrievalConfig = {
      topK: patch.topK ?? current.topK,
      candidatesPerSource: patch.candidatesPerSource ?? current.candidatesPerSource,
      contextTokens: patch.contextTokens ?? current.contextTokens,
      timeoutMs: patch.timeoutMs ?? current.timeoutMs,
      sources: { ...current.sources, ...(patch.sources ?? {}) },
      rankingWeights: { ...current.rankingWeights, ...(patch.rankingWeights ?? {}) },
      synthesisEnabled: patch.synthesisEnabled ?? current.synthesisEnabled,
    };
    await this.settings.updateSettings(
      [{ key: RETRIEVAL_SETTING_KEYS.Config, value: next }],
      actor,
      'Update AI retrieval config',
    );
    return next;
  }
}

/** Defensively merge a stored (possibly partial/unknown) config over compiled defaults. */
function mergeConfig(raw: unknown): ResolvedRetrievalConfig {
  if (raw === null || typeof raw !== 'object') return DEFAULT_RETRIEVAL_CONFIG;
  const r = raw as Record<string, unknown>;
  const d = DEFAULT_RETRIEVAL_CONFIG;
  return {
    topK: num(r.topK, d.topK),
    candidatesPerSource: num(r.candidatesPerSource, d.candidatesPerSource),
    contextTokens: num(r.contextTokens, d.contextTokens),
    timeoutMs: num(r.timeoutMs, d.timeoutMs),
    sources: mergeRecord(r.sources, d.sources) as Record<RetrievalSource, boolean>,
    rankingWeights: mergeRecord(r.rankingWeights, d.rankingWeights) as Record<
      RankingSignal,
      number
    >,
    synthesisEnabled:
      typeof r.synthesisEnabled === 'boolean' ? r.synthesisEnabled : d.synthesisEnabled,
  };
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function mergeRecord<T>(value: unknown, defaults: Record<string, T>): Record<string, T> {
  if (value === null || typeof value !== 'object') return { ...defaults };
  return { ...defaults, ...(value as Record<string, T>) };
}
