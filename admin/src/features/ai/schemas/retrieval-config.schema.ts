import {
  RankingSignal,
  RETRIEVAL_CONFIG_BOUNDS,
  RetrievalSource,
  type RankingSignal as RankingSignalType,
  type RetrievalSource as RetrievalSourceType,
} from '@qalam/shared';
import { z } from 'zod';

/**
 * The retrieval-config form (A3). Every bound is `RETRIEVAL_CONFIG_BOUNDS` from `@qalam/shared` —
 * the same constant `UpdateRetrievalConfigDto` validates against — so the form cannot submit a
 * value the route will reject, and a bound only ever moves in one place.
 *
 * The two tables are TOTAL here even though the endpoint accepts a partial patch: the read always
 * answers with every source and every signal (the service merges over compiled defaults), so the
 * form renders a complete set and submits a complete set. That also means a weight cannot be lost
 * by a key silently missing from the payload.
 */

const bounds = RETRIEVAL_CONFIG_BOUNDS;

const weight = z.number().min(bounds.rankingWeight.min).max(bounds.rankingWeight.max);

/** `z.record` over a closed key set, so a renamed enum member fails the build rather than the form. */
const sourcesSchema = z.object(
  Object.fromEntries(
    Object.values(RetrievalSource).map((source) => [source, z.boolean()]),
  ) as Record<RetrievalSourceType, z.ZodBoolean>,
);

const rankingWeightsSchema = z.object(
  Object.fromEntries(Object.values(RankingSignal).map((signal) => [signal, weight])) as Record<
    RankingSignalType,
    typeof weight
  >,
);

export const retrievalConfigSchema = z.object({
  topK: z.number().int().min(bounds.topK.min).max(bounds.topK.max),
  candidatesPerSource: z
    .number()
    .int()
    .min(bounds.candidatesPerSource.min)
    .max(bounds.candidatesPerSource.max),
  contextTokens: z.number().int().min(bounds.contextTokens.min).max(bounds.contextTokens.max),
  timeoutMs: z.number().int().min(bounds.timeoutMs.min).max(bounds.timeoutMs.max),
  sources: sourcesSchema,
  rankingWeights: rankingWeightsSchema,
});

export type RetrievalConfigForm = z.infer<typeof retrievalConfigSchema>;
