import { Injectable } from '@nestjs/common';
import {
  askScopeNodeTypes,
  RankingSignal,
  RetrievalIntent,
  RetrievalQueryType,
  RetrievalSource,
  RETRIEVAL_MAX_TOP_K,
} from '@qalam/shared';

import type { ResolvedRetrievalConfig, RetrievalPlan, RetrievalRequest } from '../retrieval.types';

/** Graph node types a query-type biases retrieval toward ([] = all types). */
const QUERY_TYPE_NODE_TYPES: Record<RetrievalQueryType, string[]> = {
  [RetrievalQueryType.Character]: ['character'],
  [RetrievalQueryType.Relationship]: ['character'],
  [RetrievalQueryType.Location]: ['location'],
  [RetrievalQueryType.Event]: ['event'],
  [RetrievalQueryType.Timeline]: ['event'],
  [RetrievalQueryType.Scene]: ['event', 'character'],
  [RetrievalQueryType.Chapter]: ['event', 'character'],
  [RetrievalQueryType.WorldBuilding]: ['location', 'organization', 'object', 'concept'],
  [RetrievalQueryType.Concept]: ['concept'],
  [RetrievalQueryType.Dialogue]: [],
  [RetrievalQueryType.Quote]: [],
  [RetrievalQueryType.NaturalLanguage]: [],
};

/**
 * The Retrieval Planner (AF4) — the brain of the platform. Given the classified request +
 * admin config it decides: WHICH sources to run (story-scoped → knowledge graph;
 * library-scoped → keyword + metadata; vector always considered but inert until available),
 * their order, parallel vs sequential execution, per-source + context-token budgets, the
 * ranking signal emphasis, which graph node types to prioritise, and whether to synthesise
 * a grounded LLM answer. Every AI feature routes through a plan — nothing bypasses it.
 */
@Injectable()
export class RetrievalPlannerService {
  plan(request: RetrievalRequest, config: ResolvedRetrievalConfig): RetrievalPlan {
    const queryType = request.queryType ?? RetrievalQueryType.NaturalLanguage;
    const storyScoped = request.storyId !== undefined && request.storyId !== '';

    // Story-scoped requests ground on the knowledge graph (SSOT); library-scoped requests
    // use lexical + metadata search. The vector source is listed only when configured on
    // AND available (the RetrievalService double-checks availability at run time).
    const wanted: RetrievalSource[] = storyScoped
      ? [RetrievalSource.KnowledgeGraph, RetrievalSource.Vector]
      : [RetrievalSource.Keyword, RetrievalSource.Metadata, RetrievalSource.Vector];
    const sources = wanted.filter((s) => config.sources[s] !== false);

    const nodeTypes =
      request.intent === RetrievalIntent.Ask && request.scope !== undefined
        ? [...askScopeNodeTypes(request.scope)]
        : QUERY_TYPE_NODE_TYPES[queryType];

    const topK = Math.min(
      Math.max(1, request.limit > 0 ? request.limit : config.topK),
      config.topK,
      RETRIEVAL_MAX_TOP_K,
    );

    return {
      intent: request.intent,
      queryType,
      sources,
      parallel: sources.length > 1,
      candidatesPerSource: config.candidatesPerSource,
      topK,
      contextTokens: config.contextTokens,
      timeoutMs: config.timeoutMs,
      rankingSignals: rankingOrder(config),
      rankingWeights: config.rankingWeights,
      nodeTypes,
    };
  }
}

/** Signals with a positive weight, most-emphasised first (drives ranking + explanations). */
function rankingOrder(config: ResolvedRetrievalConfig): RankingSignal[] {
  return (Object.entries(config.rankingWeights) as Array<[RankingSignal, number]>)
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([signal]) => signal);
}
