import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  StoryAnalysisKind,
  StoryAnalysisScope,
  StoryAnalysisStatus,
  StoryNodeType,
} from '@qalam/shared';
import { normalizeStoryName } from '@qalam/shared';
import { DataSource, type EntityManager, Repository } from 'typeorm';

import type { CursorPayload } from '../../common/pagination/cursor.util';
import { StoryAnalysis } from './entities/story-analysis.entity';
import { StoryEdge } from './entities/story-edge.entity';
import { StoryGraph } from './entities/story-graph.entity';
import { StoryNode } from './entities/story-node.entity';
import type { ParsedAnalysis } from './story.types';

/** Provenance + usage recorded on the analysis run. */
export interface AnalysisMeta {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
}

/**
 * Persistence for the story knowledge graph (AF3). The graph is one aggregate
 * (graph + nodes + edges + analysis runs), so this single repository owns all four
 * tables (docs 16 §3.3). Node/edge upserts + the run record + count refresh run in one
 * transaction so an analysis is all-or-nothing. Nodes dedupe on `(graphId, type,
 * normalizedName)` — the same entity across analyses MERGES (aliases/mentions/evidence/
 * confidence), so the graph accumulates rather than duplicating. Ownership is enforced
 * by the service; this layer just runs the queries.
 */
@Injectable()
export class StoryIntelligenceRepository {
  constructor(
    @InjectRepository(StoryGraph) private readonly graphs: Repository<StoryGraph>,
    @InjectRepository(StoryNode) private readonly nodes: Repository<StoryNode>,
    @InjectRepository(StoryEdge) private readonly edges: Repository<StoryEdge>,
    @InjectRepository(StoryAnalysis) private readonly analyses: Repository<StoryAnalysis>,
    private readonly dataSource: DataSource,
  ) {}

  findGraph(userId: string, storyId: string): Promise<StoryGraph | null> {
    return this.graphs.findOne({ where: { userId, storyId } });
  }

  async getOrCreateGraph(
    userId: string,
    storyId: string,
    title: string | null,
  ): Promise<StoryGraph> {
    const existing = await this.findGraph(userId, storyId);
    if (existing !== null) {
      if (title !== null && (existing.title === null || existing.title === '')) {
        existing.title = title;
        return this.graphs.save(existing);
      }
      return existing;
    }
    return this.graphs.save(
      this.graphs.create({
        userId,
        storyId,
        title,
        nodeCount: 0,
        edgeCount: 0,
        analysisCount: 0,
        lastAnalyzedAt: null,
        lastScope: null,
      }),
    );
  }

  listNodes(graphId: string, type?: StoryNodeType): Promise<StoryNode[]> {
    return this.nodes.find({
      where: type === undefined ? { graphId } : { graphId, type },
      order: { mentionCount: 'DESC', name: 'ASC' },
    });
  }

  listEdges(graphId: string): Promise<StoryEdge[]> {
    return this.edges.find({ where: { graphId } });
  }

  /** Over-fetches `limit + 1` (newest first) so the service can compute `hasMore`. */
  listAnalyses(
    graphId: string,
    cursor: CursorPayload | null,
    limit: number,
  ): Promise<StoryAnalysis[]> {
    const qb = this.analyses
      .createQueryBuilder('a')
      .where('a.graph_id = :graphId', { graphId })
      .orderBy('a.created_at', 'DESC')
      .addOrderBy('a.id', 'DESC')
      .limit(limit + 1);
    if (cursor !== null) {
      qb.andWhere('(a.created_at, a.id) < (:ck::timestamptz, :cid::uuid)', {
        ck: cursor.k,
        cid: cursor.id,
      });
    }
    return qb.getMany();
  }

  findAnalysis(graphId: string, id: string): Promise<StoryAnalysis | null> {
    return this.analyses.findOne({ where: { id, graphId } });
  }

  /** Hard-delete the whole graph aggregate, atomically. */
  async deleteGraph(graphId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(StoryEdge, { graphId });
      await manager.delete(StoryNode, { graphId });
      await manager.delete(StoryAnalysis, { graphId });
      await manager.delete(StoryGraph, { id: graphId });
    });
  }

  /**
   * Apply a parsed analysis to the graph atomically: upsert (merge) nodes, resolve +
   * upsert edges, insert the analysis run, refresh the graph counts. Returns the run.
   */
  async applyAnalysis(
    graph: StoryGraph,
    kind: StoryAnalysisKind,
    scope: StoryAnalysisScope,
    status: StoryAnalysisStatus,
    parsed: ParsedAnalysis,
    meta: AnalysisMeta,
  ): Promise<StoryAnalysis> {
    return this.dataSource.transaction(async (manager) => {
      const nodeIdByKey = await this.upsertNodes(manager, graph.id, parsed);
      await this.upsertEdges(manager, graph.id, parsed, nodeIdByKey);

      const run = await manager.save(
        manager.create(StoryAnalysis, {
          graphId: graph.id,
          userId: graph.userId,
          kind,
          scope,
          status,
          summary: parsed.summary,
          recommendations: parsed.recommendations,
          confidenceScore: parsed.confidenceScore,
          evidence: parsed.evidence,
          affectedChapters: parsed.affectedChapters,
          affectedCharacters: parsed.affectedCharacters,
          structured: parsed.structured,
          rawOutput: parsed.rawOutput,
          provider: meta.provider,
          model: meta.model,
          inputTokens: meta.inputTokens,
          outputTokens: meta.outputTokens,
          totalTokens: meta.totalTokens,
          costUsd: meta.costUsd,
        }),
      );

      const [nodeCount, edgeCount] = await Promise.all([
        manager.count(StoryNode, { where: { graphId: graph.id } }),
        manager.count(StoryEdge, { where: { graphId: graph.id } }),
      ]);
      await manager
        .createQueryBuilder()
        .update(StoryGraph)
        .set({
          nodeCount,
          edgeCount,
          analysisCount: () => 'analysis_count + 1',
          lastAnalyzedAt: run.createdAt,
          lastScope: scope,
        })
        .where('id = :id', { id: graph.id })
        .execute();

      return run;
    });
  }

  private async upsertNodes(
    manager: EntityManager,
    graphId: string,
    parsed: ParsedAnalysis,
  ): Promise<Map<string, string>> {
    const idByKey = new Map<string, string>();
    // Index ALL existing nodes once: lets same-name entities MERGE and lets edges from
    // this run resolve endpoints against earlier analyses (cross-kind links).
    const existingByKey = new Map<string, StoryNode>();
    for (const node of await manager.find(StoryNode, { where: { graphId } })) {
      const key = nodeKey(node.type, node.normalizedName);
      existingByKey.set(key, node);
      idByKey.set(key, node.id);
    }

    for (const upsert of parsed.nodes) {
      const normalizedName = normalizeStoryName(upsert.name);
      if (normalizedName === '') {
        continue;
      }
      const key = nodeKey(upsert.type, normalizedName);
      const current = existingByKey.get(key);
      if (current !== undefined) {
        current.aliases = unionStrings(current.aliases, upsert.aliases);
        current.confidence = Math.max(current.confidence, upsert.confidence);
        current.mentionCount += upsert.mentionCount;
        current.summary = current.summary !== '' ? current.summary : upsert.summary;
        current.firstChapter = current.firstChapter ?? upsert.firstChapter;
        current.data = { ...current.data, ...upsert.data };
        current.evidence = mergeEvidence(current.evidence, upsert.evidence);
        const saved = await manager.save(current);
        idByKey.set(key, saved.id);
      } else {
        const saved = await manager.save(
          manager.create(StoryNode, {
            graphId,
            type: upsert.type,
            name: upsert.name,
            normalizedName,
            aliases: upsert.aliases,
            summary: upsert.summary,
            data: upsert.data,
            confidence: upsert.confidence,
            mentionCount: upsert.mentionCount,
            firstChapter: upsert.firstChapter,
            evidence: upsert.evidence,
          }),
        );
        existingByKey.set(key, saved);
        idByKey.set(key, saved.id);
      }
    }
    return idByKey;
  }

  private async upsertEdges(
    manager: EntityManager,
    graphId: string,
    parsed: ParsedAnalysis,
    nodeIdByKey: Map<string, string>,
  ): Promise<void> {
    for (const upsert of parsed.edges) {
      const sourceId = nodeIdByKey.get(
        nodeKey(upsert.sourceType, normalizeStoryName(upsert.sourceName)),
      );
      const targetId = nodeIdByKey.get(
        nodeKey(upsert.targetType, normalizeStoryName(upsert.targetName)),
      );
      // Drop edges whose endpoints don't resolve to a node — never orphan an edge.
      if (sourceId === undefined || targetId === undefined || sourceId === targetId) {
        continue;
      }
      const existing = await manager.findOne(StoryEdge, {
        where: { graphId, sourceId, targetId, type: upsert.type },
      });
      if (existing !== null) {
        existing.label = upsert.label !== '' ? upsert.label : existing.label;
        existing.confidence = Math.max(existing.confidence, upsert.confidence);
        existing.data = { ...existing.data, ...upsert.data };
        existing.evidence = mergeEvidence(existing.evidence, upsert.evidence);
        await manager.save(existing);
      } else {
        await manager.save(
          manager.create(StoryEdge, {
            graphId,
            sourceId,
            targetId,
            type: upsert.type,
            label: upsert.label,
            data: upsert.data,
            confidence: upsert.confidence,
            evidence: upsert.evidence,
          }),
        );
      }
    }
  }
}

function nodeKey(type: string, normalizedName: string): string {
  return `${type}::${normalizedName}`;
}

function unionStrings(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b].filter((s) => s !== ''))];
}

function mergeEvidence(
  a: Array<{ chapterRef: string | null; quote: string }>,
  b: Array<{ chapterRef: string | null; quote: string }>,
): Array<{ chapterRef: string | null; quote: string }> {
  const seen = new Set(a.map((e) => e.quote));
  const merged = [...a];
  for (const e of b) {
    if (!seen.has(e.quote)) {
      merged.push(e);
      seen.add(e.quote);
    }
  }
  // Cap retained evidence so a hot entity's row can't grow unbounded.
  return merged.slice(0, 20);
}
