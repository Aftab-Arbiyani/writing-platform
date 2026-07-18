import type { StoryEventKind } from '@qalam/shared';

import type { StoryAnalysis } from './entities/story-analysis.entity';
import type { StoryEdge } from './entities/story-edge.entity';
import type { StoryNode } from './entities/story-node.entity';
import type {
  StoryAnalysisResultDto,
  StoryAnalysisSummaryDto,
  StoryCharacterGraphDto,
  StoryEdgeDto,
  StoryEvidenceDto,
  StoryGraphDto,
  StoryNodeDto,
  StoryTimelineDto,
  StoryTimelineEntryDto,
} from './dto/story-response.dto';
import type { StoryEvidenceRef } from './story.types';
import type { GraphView } from './story-intelligence.service';
import type { StoryGraph } from './entities/story-graph.entity';

/** entity → response-DTO mappers (never return entities raw, docs 16 §3.2). */

function toEvidenceDto(e: StoryEvidenceRef): StoryEvidenceDto {
  return { chapterRef: e.chapterRef, quote: e.quote };
}

export function toNodeDto(node: StoryNode): StoryNodeDto {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    aliases: node.aliases,
    summary: node.summary,
    data: node.data,
    confidence: node.confidence,
    mentionCount: node.mentionCount,
    firstChapter: node.firstChapter,
    evidence: node.evidence.map(toEvidenceDto),
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
  };
}

export function toEdgeDto(edge: StoryEdge): StoryEdgeDto {
  return {
    id: edge.id,
    type: edge.type,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    label: edge.label,
    data: edge.data,
    confidence: edge.confidence,
    evidence: edge.evidence.map(toEvidenceDto),
  };
}

export function toGraphDto(view: GraphView): StoryGraphDto {
  return {
    storyId: view.graph.storyId,
    title: view.graph.title,
    nodeCount: view.graph.nodeCount,
    edgeCount: view.graph.edgeCount,
    analysisCount: view.graph.analysisCount,
    lastAnalyzedAt: view.graph.lastAnalyzedAt?.toISOString() ?? null,
    nodes: view.nodes.map(toNodeDto),
    edges: view.edges.map(toEdgeDto),
  };
}

export function toCharacterGraphDto(view: {
  graph: StoryGraph;
  characters: StoryNode[];
  relationships: StoryEdge[];
}): StoryCharacterGraphDto {
  return {
    storyId: view.graph.storyId,
    characters: view.characters.map(toNodeDto),
    relationships: view.relationships.map(toEdgeDto),
  };
}

export function toTimelineDto(graph: StoryGraph, events: StoryNode[]): StoryTimelineDto {
  return { storyId: graph.storyId, entries: events.map(toTimelineEntryDto) };
}

function toTimelineEntryDto(node: StoryNode): StoryTimelineEntryDto {
  const data = node.data;
  return {
    id: node.id,
    name: node.name,
    description: node.summary,
    kind: readEventKind(data.kind),
    chapterRef: typeof data.chapterRef === 'string' ? data.chapterRef : null,
    order: typeof data.order === 'number' ? data.order : 0,
    characters: Array.isArray(data.characters)
      ? data.characters.filter((c): c is string => typeof c === 'string')
      : [],
    location: typeof data.location === 'string' ? data.location : null,
  };
}

export function toAnalysisResultDto(a: StoryAnalysis, storyId: string): StoryAnalysisResultDto {
  return {
    id: a.id,
    storyId,
    kind: a.kind,
    scope: a.scope,
    status: a.status,
    summary: a.summary,
    recommendations: a.recommendations,
    confidenceScore: a.confidenceScore,
    evidence: a.evidence.map(toEvidenceDto),
    affectedChapters: a.affectedChapters,
    affectedCharacters: a.affectedCharacters,
    structured: a.structured,
    usage: { inputTokens: a.inputTokens, outputTokens: a.outputTokens, totalTokens: a.totalTokens },
    estimatedCostUsd: a.costUsd,
    provider: a.provider,
    model: a.model,
    createdAt: a.createdAt.toISOString(),
    rawOutput: a.rawOutput,
  };
}

export function toAnalysisSummaryDto(a: StoryAnalysis): StoryAnalysisSummaryDto {
  return {
    id: a.id,
    kind: a.kind,
    scope: a.scope,
    status: a.status,
    summary: a.summary,
    confidenceScore: a.confidenceScore,
    createdAt: a.createdAt.toISOString(),
  };
}

function readEventKind(value: unknown): StoryEventKind {
  return value === 'flashback' || value === 'future'
    ? (value as StoryEventKind)
    : ('chronological' as StoryEventKind);
}
