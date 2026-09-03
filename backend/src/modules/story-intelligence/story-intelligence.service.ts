import { Injectable } from '@nestjs/common';
import {
  AiMessageRole,
  PremiumFeature,
  STORY_GRAPH_TITLE_MAX,
  STORY_MAP_ANALYSIS_COUNT,
  StoryAnalysisKind,
  StoryAnalysisScope,
  storyAnalysisFeature,
  storyAnalysisPromptKey,
} from '@qalam/shared';

import type { CursorPayload } from '../../common/pagination/cursor.util';
import { decodeCursor, encodeCursor } from '../../common/pagination/cursor.util';
import { AiCompletionService } from '../ai/orchestration/ai-completion.service';
import { EntitlementService } from '../monetization/entitlement.service';
import { MonetizationFeatureService } from '../monetization/monetization.feature-service';
import { UsageService } from '../monetization/usage.service';
import { parseStoryAnalysis } from './analysis/story-analysis.parser';
import type { StoryGraphDto } from './dto/story-response.dto';
import { toGraphDto } from './story.mappers';
import type { StoryAnalysis } from './entities/story-analysis.entity';
import type { StoryEdge } from './entities/story-edge.entity';
import type { StoryGraph } from './entities/story-graph.entity';
import type { StoryNode } from './entities/story-node.entity';
import { StoryIntelligenceRepository } from './story-intelligence.repository';
import {
  StoryAnalysisNotFoundException,
  StoryContentEmptyException,
  StoryNotFoundException,
} from './story.exceptions';

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 50;

/** The analyses a full "Map this story" run performs, in the order it performs them. */
const STORY_MAP_KINDS: readonly StoryAnalysisKind[] = [
  StoryAnalysisKind.Character,
  StoryAnalysisKind.Plot,
  StoryAnalysisKind.World,
  StoryAnalysisKind.Style,
  StoryAnalysisKind.Timeline,
];

/** A request to map a whole story (already DTO-validated at the controller). */
export interface MapStoryInput {
  content: string;
  storyTitle?: string;
}

/** What a map run reports as it goes. */
export type MapStoryEvent =
  | { kind: 'progress'; step: number; total: number; analysis: StoryAnalysisKind }
  | { kind: 'done'; completed: StoryAnalysisKind[] };

/** A request to run one analysis (already DTO-validated at the controller). */
export interface AnalyzeInput {
  kind: StoryAnalysisKind;
  scope: StoryAnalysisScope;
  content: string;
  chapterRef?: string;
  storyTitle?: string;
}

/** A page of analysis-run history. */
export interface AnalysisHistoryPage {
  items: StoryAnalysis[];
  meta: { limit: number; hasMore: boolean; nextCursor: string | null };
}

/** The full graph read model (aggregate + nodes + edges). */
export interface GraphView {
  graph: StoryGraph;
  nodes: StoryNode[];
  edges: StoryEdge[];
}

/**
 * Story Intelligence orchestration (AF3). Reuses the AF1 platform end to end: every
 * analysis is a `AiCompletionService.complete()` call (which enforces the per-feature
 * flag, usage limits, prompt rendering, provider dispatch, safety, and token
 * accounting) whose output is parsed into STRUCTURED objects and persisted into the
 * story knowledge graph — the single source of truth. No prompt text, streaming, or
 * token math is reimplemented here. Every read is owner-scoped.
 */
@Injectable()
export class StoryIntelligenceService {
  constructor(
    private readonly completion: AiCompletionService,
    private readonly repo: StoryIntelligenceRepository,
    private readonly feature: MonetizationFeatureService,
    private readonly entitlements: EntitlementService,
    private readonly usage: UsageService,
  ) {}

  /**
   * Dark-launch-aware entitlement check for a graph READ (D4, docs/48 §5.2, decided
   * 2026-08-21). Mirrors `AiUsageMeterService.checkQuota`'s own escape hatch exactly:
   * with payments dark nobody holds a subscription, so a gate that ran anyway would
   * deny EVERY user rather than just free ones.
   *
   * Deliberately NOT inside {@link getGraph}/{@link getGraphSnapshot} — that method is
   * also the reuse seam for `Recommendations` and Ask My Book's `GraphRetriever`
   * (both confirmed free by the same D4 decision), so gating it there would silently
   * wall those off too. Every read that has no other caller asserts this itself;
   * `getGraph`'s controller action asserts it before calling in, since `getGraph` is
   * the one method that isn't call-site-exclusive to this feature.
   */
  async assertGraphReadEntitled(userId: string): Promise<void> {
    if (!(await this.feature.isEnabled())) return;
    await this.entitlements.assertAllowed(userId, PremiumFeature.StoryIntelligence);
  }

  /**
   * Run an analysis and fold its structured result into the graph. Returns the
   * persisted run (the "Analysis Result": structured objects + summary + recommendations
   * + confidence + evidence + affected chapters/characters + usage). The AF1 orchestrator
   * enforces the feature flag + usage limits, so a disabled feature throws AI_FEATURE_DISABLED.
   */
  async analyze(userId: string, storyId: string, input: AnalyzeInput): Promise<StoryAnalysis> {
    const content = input.content.trim();
    if (content === '') {
      throw new StoryContentEmptyException();
    }

    const output = await this.completion.complete({
      userId,
      feature: storyAnalysisFeature(input.kind),
      promptKey: storyAnalysisPromptKey(input.kind),
      promptVariables: {
        scope: input.scope,
        chapterRef: input.chapterRef ?? '',
      },
      messages: [{ role: AiMessageRole.User, content }],
    });

    const parsed = parseStoryAnalysis(input.kind, output.content);
    const graph = await this.repo.getOrCreateGraph(
      userId,
      storyId,
      input.storyTitle?.slice(0, STORY_GRAPH_TITLE_MAX).trim() || null,
    );

    return this.repo.applyAnalysis(graph, input.kind, input.scope, parsed.status, parsed, {
      provider: output.provider,
      model: output.model,
      inputTokens: output.usage.inputTokens,
      outputTokens: output.usage.outputTokens,
      totalTokens: output.usage.totalTokens,
      costUsd: output.costUsd,
    });
  }

  /**
   * Build a story's whole map: run every analysis kind in turn and fold each into the graph.
   *
   * This is the action that makes Story Map a feature rather than a viewer. Until D5 the
   * analyses had no client on any platform (48 §3.22d) — seven routes nobody could reach —
   * so a Pro subscriber could look at a graph they had no way to build.
   *
   * Yields progress rather than returning, because five sequential model calls take long
   * enough that a buffered response would sit behind a proxy timeout with nothing to show.
   *
   * **The whole cost is reserved up front.** Each analysis meters itself as one story
   * analysis on the way through the orchestrator, so a writer with three left would otherwise
   * get three analyses, a 429, and a half-built graph that looks like a finished one. Refusing
   * before the first call is the difference between "not enough allowance" and silent
   * corruption of the thing they were building.
   *
   * Runs SEQUENTIALLY on purpose: the analyses write to one graph, and the repository folds
   * each result into it. Parallelism here would race those writes for a few seconds' latency.
   *
   * A failure mid-run keeps what already landed — a partly-mapped graph is more useful than
   * none, and re-running folds the rest in — so the caller is told which kinds completed.
   */
  async *mapStory(
    userId: string,
    storyId: string,
    input: MapStoryInput,
  ): AsyncGenerator<MapStoryEvent> {
    const content = input.content.trim();
    if (content === '') {
      throw new StoryContentEmptyException();
    }
    await this.assertGraphReadEntitled(userId);
    if (await this.feature.isEnabled()) {
      // Any story kind resolves to the same allowance; the reservation is the whole set.
      await this.usage.assertWithinQuota(
        userId,
        storyAnalysisFeature(StoryAnalysisKind.Character),
        STORY_MAP_ANALYSIS_COUNT,
      );
    }

    const completed: StoryAnalysisKind[] = [];
    for (const [index, kind] of STORY_MAP_KINDS.entries()) {
      yield { kind: 'progress', step: index + 1, total: STORY_MAP_KINDS.length, analysis: kind };
      await this.analyze(userId, storyId, {
        kind,
        scope: StoryAnalysisScope.Book,
        content,
        storyTitle: input.storyTitle,
      });
      completed.push(kind);
    }
    yield { kind: 'done', completed };
  }

  /** The full knowledge graph for a story the caller owns. */
  async getGraph(userId: string, storyId: string): Promise<GraphView> {
    const graph = await this.getOwnedGraphOrThrow(userId, storyId);
    const [nodes, edges] = await Promise.all([
      this.repo.listNodes(graph.id),
      this.repo.listEdges(graph.id),
    ]);
    return { graph, nodes, edges };
  }

  /**
   * A boundary-safe snapshot of the full knowledge graph for cross-module reuse (the AF4
   * Retrieval Platform, and any future feature that grounds on the graph). Returns the
   * shared wire shape (`@qalam/api-types` StoryGraph) so consumers never import this
   * module's entities (docs 16 §3.1 module isolation). Owner-scoped → STORY_NOT_FOUND.
   * This is the intended reuse seam from docs/35 §10: "future features inject the graph
   * as context instead of re-analysing."
   */
  async getGraphSnapshot(userId: string, storyId: string): Promise<StoryGraphDto> {
    return toGraphDto(await this.getGraph(userId, storyId));
  }

  /** Character nodes + the relationship edges among them. */
  async getCharacterGraph(
    userId: string,
    storyId: string,
  ): Promise<{ graph: StoryGraph; characters: StoryNode[]; relationships: StoryEdge[] }> {
    await this.assertGraphReadEntitled(userId);
    const graph = await this.getOwnedGraphOrThrow(userId, storyId);
    const [characters, allEdges] = await Promise.all([
      this.repo.listNodes(graph.id, 'character'),
      this.repo.listEdges(graph.id),
    ]);
    const characterIds = new Set(characters.map((c) => c.id));
    const relationships = allEdges.filter(
      (e) =>
        e.type === 'relationship' && characterIds.has(e.sourceId) && characterIds.has(e.targetId),
    );
    return { graph, characters, relationships };
  }

  /** Event nodes ordered chronologically (the timeline view). */
  async getTimeline(
    userId: string,
    storyId: string,
  ): Promise<{ graph: StoryGraph; events: StoryNode[] }> {
    await this.assertGraphReadEntitled(userId);
    const graph = await this.getOwnedGraphOrThrow(userId, storyId);
    const events = await this.repo.listNodes(graph.id, 'event');
    events.sort((a, b) => orderOf(a) - orderOf(b));
    return { graph, events };
  }

  async listAnalyses(
    userId: string,
    storyId: string,
    rawCursor: string | undefined,
    rawLimit?: number,
  ): Promise<AnalysisHistoryPage> {
    await this.assertGraphReadEntitled(userId);
    const graph = await this.getOwnedGraphOrThrow(userId, storyId);
    const limit = Math.min(Math.max(rawLimit ?? PAGE_SIZE_DEFAULT, 1), PAGE_SIZE_MAX);
    const cursor: CursorPayload | null = decodeCursor(rawCursor);
    const rows = await this.repo.listAnalyses(graph.id, cursor, limit);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items.at(-1);
    return {
      items,
      meta: {
        limit,
        hasMore,
        nextCursor:
          hasMore && last !== undefined
            ? encodeCursor({ k: last.createdAt.toISOString(), id: last.id })
            : null,
      },
    };
  }

  async getAnalysis(userId: string, storyId: string, analysisId: string): Promise<StoryAnalysis> {
    await this.assertGraphReadEntitled(userId);
    const graph = await this.getOwnedGraphOrThrow(userId, storyId);
    const analysis = await this.repo.findAnalysis(graph.id, analysisId);
    if (analysis === null) {
      throw new StoryAnalysisNotFoundException();
    }
    return analysis;
  }

  async resetGraph(userId: string, storyId: string): Promise<void> {
    await this.assertGraphReadEntitled(userId);
    const graph = await this.getOwnedGraphOrThrow(userId, storyId);
    await this.repo.deleteGraph(graph.id);
  }

  private async getOwnedGraphOrThrow(userId: string, storyId: string): Promise<StoryGraph> {
    const graph = await this.repo.findGraph(userId, storyId);
    if (graph === null) {
      throw new StoryNotFoundException();
    }
    return graph;
  }
}

/** Timeline sort key from an event node's `data.order` (fallback: 0). */
function orderOf(node: StoryNode): number {
  const order = node.data.order;
  return typeof order === 'number' && Number.isFinite(order) ? order : 0;
}
