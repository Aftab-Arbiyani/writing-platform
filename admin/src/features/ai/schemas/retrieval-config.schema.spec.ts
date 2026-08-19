import { RankingSignal, RETRIEVAL_CONFIG_BOUNDS, RetrievalSource } from '@qalam/shared';
import { describe, expect, it } from 'vitest';

import { retrievalConfigSchema } from './retrieval-config.schema';
import type { RetrievalConfigForm } from './retrieval-config.schema';

/**
 * The form contract for `PUT /admin/ai/search-config` (A3).
 *
 * The point of these is that the client bound and the server bound are the SAME constant. Before
 * A3 the route accepted any object for either table, so a form was the only thing standing between
 * an operator and a config the planner silently ignores; now both sides read
 * `RETRIEVAL_CONFIG_BOUNDS`, and a control that offered something out of range would fail here
 * before it ever reached a 400.
 */

function form(overrides: Partial<RetrievalConfigForm> = {}): Record<string, unknown> {
  return {
    topK: 10,
    candidatesPerSource: 40,
    contextTokens: 2000,
    timeoutMs: 8000,
    sources: {
      [RetrievalSource.KnowledgeGraph]: true,
      [RetrievalSource.Metadata]: true,
      [RetrievalSource.Keyword]: true,
      [RetrievalSource.Vector]: true,
    },
    rankingWeights: Object.fromEntries(Object.values(RankingSignal).map((signal) => [signal, 0.5])),
    synthesisEnabled: true,
    ...overrides,
  };
}

/** The same table minus one key — how a partial payload would reach the route. */
function without(table: unknown, key: string): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(table as Record<string, unknown>).filter(([entry]) => entry !== key),
  );
}

describe('retrievalConfigSchema', () => {
  it('accepts a complete, in-range snapshot', () => {
    expect(retrievalConfigSchema.safeParse(form()).success).toBe(true);
  });

  it('requires every source, so a toggle cannot be dropped from the payload', () => {
    expect(
      retrievalConfigSchema.safeParse(
        form({ sources: without(form().sources, RetrievalSource.Vector) as never }),
      ).success,
    ).toBe(false);
  });

  it('requires every ranking signal, so a weight cannot be lost in a submit', () => {
    expect(
      retrievalConfigSchema.safeParse(
        form({ rankingWeights: without(form().rankingWeights, RankingSignal.Confidence) as never }),
      ).success,
    ).toBe(false);
  });

  it('rejects an unknown source or signal key', () => {
    expect(
      retrievalConfigSchema.safeParse(form({ sources: { pigeon_post: true } as never })).success,
    ).toBe(false);
    expect(
      retrievalConfigSchema.safeParse(form({ rankingWeights: { vibes: 0.5 } as never })).success,
    ).toBe(false);
  });

  it('holds each scalar to the shared bound the route validates against', () => {
    const bounds = RETRIEVAL_CONFIG_BOUNDS;

    expect(retrievalConfigSchema.safeParse(form({ topK: bounds.topK.max })).success).toBe(true);
    expect(retrievalConfigSchema.safeParse(form({ topK: bounds.topK.max + 1 })).success).toBe(
      false,
    );
    expect(retrievalConfigSchema.safeParse(form({ topK: 0 })).success).toBe(false);
    expect(
      retrievalConfigSchema.safeParse(form({ timeoutMs: bounds.timeoutMs.min - 1 })).success,
    ).toBe(false);
    expect(
      retrievalConfigSchema.safeParse(form({ contextTokens: bounds.contextTokens.max + 1 }))
        .success,
    ).toBe(false);
    expect(
      retrievalConfigSchema.safeParse(
        form({ candidatesPerSource: bounds.candidatesPerSource.max + 1 }),
      ).success,
    ).toBe(false);
  });

  it('rejects a fractional budget — these are counts, not rates', () => {
    expect(retrievalConfigSchema.safeParse(form({ topK: 10.5 })).success).toBe(false);
  });

  it('accepts 0 as a weight, because 0 is how a signal is disabled', () => {
    expect(
      retrievalConfigSchema.safeParse(
        form({
          rankingWeights: Object.fromEntries(
            Object.values(RankingSignal).map((signal) => [signal, 0]),
          ) as never,
        }),
      ).success,
    ).toBe(true);
  });

  it('rejects a weight outside 0..1 in either direction', () => {
    const weights = (value: number) =>
      Object.fromEntries(Object.values(RankingSignal).map((signal) => [signal, value])) as never;

    expect(retrievalConfigSchema.safeParse(form({ rankingWeights: weights(1.01) })).success).toBe(
      false,
    );
    expect(retrievalConfigSchema.safeParse(form({ rankingWeights: weights(-0.1) })).success).toBe(
      false,
    );
  });
});
