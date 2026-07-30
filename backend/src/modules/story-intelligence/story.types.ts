import type { StoryAnalysisStatus, StoryEdgeType, StoryNodeType } from '@qalam/shared';

/** A grounding reference for a structured claim — a chapter cue + supporting quote. */
export interface StoryEvidenceRef {
  chapterRef: string | null;
  quote: string;
}

/**
 * A node to upsert into the graph. Identity is `(type, normalizedName)` within a graph,
 * so re-running an analysis merges the same entity (aliases/mentions/confidence) rather
 * than duplicating it.
 */
export interface NodeUpsert {
  type: StoryNodeType;
  name: string;
  aliases: string[];
  summary: string;
  data: Record<string, unknown>;
  confidence: number;
  mentionCount: number;
  firstChapter: string | null;
  evidence: StoryEvidenceRef[];
}

/**
 * An edge to upsert. Endpoints are referenced by `(type, name)` because node ids are
 * assigned during the node upsert; the repository resolves them to ids in the same
 * transaction. Endpoints that don't resolve to a node are dropped (never orphaned).
 */
export interface EdgeUpsert {
  type: StoryEdgeType;
  sourceType: StoryNodeType;
  sourceName: string;
  targetType: StoryNodeType;
  targetName: string;
  label: string;
  data: Record<string, unknown>;
  confidence: number;
  evidence: StoryEvidenceRef[];
}

/**
 * The structured outcome of parsing one analysis response — structured objects FIRST
 * (`structured` + the node/edge upserts), the derived prose second (`summary`,
 * `recommendations`). `rawOutput` is retained only when parsing failed/was partial.
 */
export interface ParsedAnalysis {
  status: StoryAnalysisStatus;
  summary: string;
  recommendations: string[];
  confidenceScore: number;
  evidence: StoryEvidenceRef[];
  affectedChapters: string[];
  affectedCharacters: string[];
  structured: Record<string, unknown>;
  rawOutput: string | null;
  nodes: NodeUpsert[];
  edges: EdgeUpsert[];
}
