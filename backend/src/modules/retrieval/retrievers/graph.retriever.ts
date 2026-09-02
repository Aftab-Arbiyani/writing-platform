import { Injectable } from '@nestjs/common';
import { normalizeStoryName, RetrievalSource } from '@qalam/shared';

import type { StoryEdgeDto, StoryNodeDto } from '../../story-intelligence/dto/story-response.dto';
import { StoryIntelligenceService } from '../../story-intelligence/story-intelligence.service';
import type { Retriever } from '../ports/retriever.port';
import type {
  RelatedEntity,
  RetrievalCandidate,
  RetrievalEvidence,
  RetrievalPlan,
  RetrievalRequest,
} from '../retrieval.types';
import {
  clamp01,
  lexicalScore,
  normalizeConfidence,
  saturating,
  tokenizeQuery,
  truncateToTokens,
} from '../retrieval.text.util';

const MAX_RELATED = 6;
const MAX_EVIDENCE = 3;

/**
 * Knowledge-graph retriever (AF4) — retrieves from the AF3 story knowledge graph, the
 * SINGLE SOURCE OF TRUTH. It NEVER touches the graph tables directly (module isolation):
 * it calls the exported `StoryIntelligenceService.getGraphSnapshot`, which is owner-scoped
 * (a foreign/missing story surfaces as STORY_NOT_FOUND — deliberately propagated so a
 * consumer can 404). Selection + relevance scoring happen here (retrieval owns context);
 * the graph owns knowledge. Runs only for story-scoped requests; library requests use the
 * keyword/metadata sources instead.
 */
@Injectable()
export class GraphRetriever implements Retriever {
  readonly source = RetrievalSource.KnowledgeGraph;

  constructor(private readonly story: StoryIntelligenceService) {}

  isAvailable(): boolean {
    return true;
  }

  async retrieve(plan: RetrievalPlan, request: RetrievalRequest): Promise<RetrievalCandidate[]> {
    if (request.storyId === undefined || request.storyId === '') return [];
    // The graph is owner-scoped: an anonymous caller has no graph to read, so this source
    // contributes nothing rather than querying with a missing owner (search is public since D5).
    if (request.userId === null) return [];

    // Owner-scoped read of the SSOT. STORY_NOT_FOUND propagates by design.
    const graph = await this.story.getGraphSnapshot(request.userId, request.storyId);
    if (graph.nodes.length === 0) return [];

    const terms = tokenizeQuery(request.query);
    const wantTypes = new Set(plan.nodeTypes);
    const subjectNorm =
      request.subject !== undefined && request.subject !== ''
        ? normalizeStoryName(request.subject)
        : null;

    const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
    const adjacency = buildAdjacency(graph.edges);
    const degreeHalf = 4;
    const distances = subjectNorm
      ? distancesFrom(subjectNorm, graph.nodes, adjacency)
      : new Map<string, number>();

    const scored = graph.nodes
      .filter((n) => wantTypes.size === 0 || wantTypes.has(n.type))
      .map((n) => {
        const haystack = [n.name, ...n.aliases, n.summary, JSON.stringify(n.data)].join(' ');
        const lex = terms.length > 0 ? lexicalScore(terms, haystack) : 0.4;
        const subjectMatch =
          subjectNorm !== null && normalizeStoryName(n.name) === subjectNorm ? 1 : 0;
        return { node: n, base: Math.max(lex, subjectMatch) };
      })
      // With query terms, keep only matches; for pure exploration keep everything.
      .filter((x) => terms.length === 0 || x.base > 0)
      .sort((a, b) => b.base - a.base)
      .slice(0, plan.candidatesPerSource);

    return scored.map(({ node, base }) =>
      this.toCandidate(node, base, {
        degree:
          (adjacency.get(node.id)?.size ?? 0) / (degreeHalf + (adjacency.get(node.id)?.size ?? 0)),
        distance: distances.get(node.id),
        nodesById,
        edges: graph.edges,
      }),
    );
  }

  private toCandidate(
    node: StoryNodeDto,
    base: number,
    ctx: {
      degree: number;
      distance: number | undefined;
      nodesById: Map<string, StoryNodeDto>;
      edges: StoryEdgeDto[];
    },
  ): RetrievalCandidate {
    const graphDistanceSignal =
      ctx.distance !== undefined ? 1 / (1 + ctx.distance) : clamp01(ctx.degree);

    const evidence: RetrievalEvidence[] = node.evidence.slice(0, MAX_EVIDENCE).map((e) => ({
      source: RetrievalSource.KnowledgeGraph,
      ref: node.id,
      label: node.name,
      quote: e.quote,
      score: clamp01(base),
    }));

    const related: RelatedEntity[] = ctx.edges
      .filter((e) => e.sourceId === node.id || e.targetId === node.id)
      .slice(0, MAX_RELATED)
      .map((e) => {
        const otherId = e.sourceId === node.id ? e.targetId : e.sourceId;
        const other = ctx.nodesById.get(otherId);
        return {
          id: otherId,
          type: other?.type ?? 'unknown',
          name: other?.name ?? 'Unknown',
          relation: e.label !== '' ? e.label : e.type,
        };
      })
      .filter((r) => r.name !== 'Unknown');

    const text = truncateToTokens(
      [node.name, node.summary, JSON.stringify(node.data)].filter(Boolean).join('. '),
      256,
    );

    return {
      id: node.id,
      source: RetrievalSource.KnowledgeGraph,
      type: node.type,
      title: node.name,
      summary: node.summary !== '' ? node.summary : `${node.type} in the story.`,
      object: {
        id: node.id,
        type: node.type,
        name: node.name,
        aliases: node.aliases,
        data: node.data,
        confidence: node.confidence,
        mentionCount: node.mentionCount,
        firstChapter: node.firstChapter,
      },
      text,
      baseScore: clamp01(base),
      signals: {
        semantic_similarity: clamp01(base),
        confidence: normalizeConfidence(node.confidence),
        popularity: saturating(node.mentionCount, 5),
        graph_distance: clamp01(graphDistanceSignal),
      },
      evidence,
      related,
      navigation: { kind: 'graph_node', ref: node.id, view: node.type },
    };
  }
}

/** Undirected adjacency (node id → neighbour ids) for related-entity + distance signals. */
function buildAdjacency(edges: StoryEdgeDto[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string): void => {
    const set = adj.get(a) ?? new Set<string>();
    set.add(b);
    adj.set(a, set);
  };
  for (const e of edges) {
    link(e.sourceId, e.targetId);
    link(e.targetId, e.sourceId);
  }
  return adj;
}

/** BFS hop distance from the subject node to every reachable node (graph-distance signal). */
function distancesFrom(
  subjectNorm: string,
  nodes: StoryNodeDto[],
  adjacency: Map<string, Set<string>>,
): Map<string, number> {
  const start = nodes.find((n) => normalizeStoryName(n.name) === subjectNorm);
  const dist = new Map<string, number>();
  if (start === undefined) return dist;
  dist.set(start.id, 0);
  let frontier = [start.id];
  let depth = 0;
  while (frontier.length > 0 && depth < 4) {
    depth += 1;
    const next: string[] = [];
    for (const id of frontier) {
      for (const nb of adjacency.get(id) ?? []) {
        if (!dist.has(nb)) {
          dist.set(nb, depth);
          next.push(nb);
        }
      }
    }
    frontier = next;
  }
  return dist;
}
