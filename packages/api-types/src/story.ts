/**
 * Story Intelligence wire contract (AF3) — the request/response shapes for the
 * structured story knowledge graph and its analyses over `/api/v1/story-intelligence/*`.
 *
 * The provider-agnostic VOCABULARY (kinds, node/edge types, scopes, statuses) lives in
 * `@qalam/shared` and is re-exported here so a client imports everything story-related
 * from one package. Every analysis returns STRUCTURED objects first (the `*Data`
 * payloads + the graph), with human-readable `summary`/`recommendations` derived from
 * them — never free-form text alone (docs/34 §13). Handwritten until the backend emits
 * `openapi.json` (same policy as `./ai`).
 */
export type {
  CharacterRole,
  StoryAnalysisKind,
  StoryAnalysisScope,
  StoryAnalysisStatus,
  StoryEdgeType,
  StoryEventKind,
  StoryIssueSeverity,
  StoryNodeType,
} from '@qalam/shared';

import type {
  AiTokenUsage,
  StoryAnalysisKind,
  StoryAnalysisScope,
  StoryAnalysisStatus,
  StoryEdgeType,
  StoryEventKind,
  StoryIssueSeverity,
  StoryNodeType,
} from '@qalam/shared';

// ── Shared building blocks ──────────────────────────────────────────────────

/** A grounding reference for a structured claim — a chapter cue + supporting quote. */
export interface StoryEvidence {
  chapterRef: string | null;
  quote: string;
}

/** A detected issue (plot hole, inconsistency, unresolved thread). */
export interface StoryIssue {
  title: string;
  detail: string;
  severity: StoryIssueSeverity;
  evidence: StoryEvidence[];
}

// ── Knowledge graph ─────────────────────────────────────────────────────────

/** A node in the story knowledge graph (the durable entity — character/location/…). */
export interface StoryGraphNode {
  id: string;
  type: StoryNodeType;
  name: string;
  aliases: string[];
  summary: string;
  /** Type-specific structured fields (traits/goals/arc for characters; rules/lore for concepts). */
  data: Record<string, unknown>;
  confidence: number;
  mentionCount: number;
  firstChapter: string | null;
  evidence: StoryEvidence[];
  createdAt: string;
  updatedAt: string;
}

/** An edge in the story knowledge graph (relationship / mention / occurs-at / precedes …). */
export interface StoryGraphEdge {
  id: string;
  type: StoryEdgeType;
  sourceId: string;
  targetId: string;
  label: string;
  data: Record<string, unknown>;
  confidence: number;
  evidence: StoryEvidence[];
}

/** The full story knowledge graph — the single source of truth every client renders from. */
export interface StoryGraph {
  storyId: string;
  title: string | null;
  nodeCount: number;
  edgeCount: number;
  analysisCount: number;
  lastAnalyzedAt: string | null;
  nodes: StoryGraphNode[];
  edges: StoryGraphEdge[];
}

/** Character-centric view: character nodes + the relationship edges among them. */
export interface StoryCharacterGraph {
  storyId: string;
  characters: StoryGraphNode[];
  relationships: StoryGraphEdge[];
}

// ── Per-kind structured analysis payloads ──────────────────────────────────

export interface AnalyzedCharacter {
  name: string;
  aliases: string[];
  role: string;
  traits: string[];
  goals: string[];
  motivations: string[];
  arc: string;
  growth: string;
  firstChapter: string | null;
  evidence: StoryEvidence[];
}

export interface AnalyzedRelationship {
  from: string;
  to: string;
  type: string;
  description: string;
  evidence: StoryEvidence[];
}

export interface CharacterAnalysisData {
  characters: AnalyzedCharacter[];
  relationships: AnalyzedRelationship[];
}

export interface PlotAct {
  name: string;
  summary: string;
  scenes: string[];
}

export interface PlotAnalysisData {
  acts: PlotAct[];
  scenes: Array<{ title: string; summary: string; chapterRef: string | null }>;
  conflicts: Array<{ description: string; kind: string; evidence: StoryEvidence[] }>;
  resolutions: Array<{ description: string; evidence: StoryEvidence[] }>;
  plotHoles: StoryIssue[];
  unresolvedThreads: StoryIssue[];
  foreshadowing: Array<{ setup: string; payoff: string | null; evidence: StoryEvidence[] }>;
  climax: { description: string; chapterRef: string | null } | null;
  pacing: { assessment: string; score: number };
  narrativeArc: string;
}

export interface WorldBuildingData {
  locations: Array<{ name: string; description: string; evidence: StoryEvidence[] }>;
  organizations: Array<{ name: string; description: string; evidence: StoryEvidence[] }>;
  magicSystems: Array<{ name: string; rules: string[]; description: string }>;
  objects: Array<{ name: string; significance: string }>;
  lore: Array<{ title: string; detail: string }>;
  historicalEvents: Array<{ name: string; description: string; when: string | null }>;
  terminology: Array<{ term: string; definition: string }>;
}

export interface StyleAnalysisData {
  readability: { score: number; assessment: string };
  sentenceVariety: { score: number; assessment: string };
  vocabulary: { score: number; assessment: string };
  dialogueBalance: { dialoguePercent: number; assessment: string };
  descriptionDensity: { assessment: string };
  passiveVoice: { count: number; examples: string[] };
  showVsTell: { assessment: string; tellingExamples: string[] };
  repetition: Array<{ phrase: string; count: number }>;
  consistency: StoryIssue[];
}

export interface TimelineEvent {
  name: string;
  description: string;
  kind: StoryEventKind;
  chapterRef: string | null;
  order: number;
  characters: string[];
  location: string | null;
  evidence: StoryEvidence[];
}

export interface TimelineData {
  events: TimelineEvent[];
}

// ── Analysis result envelope ────────────────────────────────────────────────

/** Every analysis returns this — structured objects first, prose derived from them. */
export interface StoryAnalysisResult {
  id: string;
  storyId: string;
  kind: StoryAnalysisKind;
  scope: StoryAnalysisScope;
  status: StoryAnalysisStatus;
  summary: string;
  recommendations: string[];
  confidenceScore: number;
  evidence: StoryEvidence[];
  affectedChapters: string[];
  affectedCharacters: string[];
  /** The kind-specific structured payload (one of the `*Data` shapes above). */
  structured: Record<string, unknown>;
  usage: AiTokenUsage;
  estimatedCostUsd: number;
  provider: string;
  model: string;
  createdAt: string;
  /** Raw model text, present only when status is `partial`/`failed`. */
  rawOutput: string | null;
}

/** Analysis-history list row (no heavy structured payload). */
export interface StoryAnalysisSummary {
  id: string;
  kind: StoryAnalysisKind;
  scope: StoryAnalysisScope;
  status: StoryAnalysisStatus;
  summary: string;
  confidenceScore: number;
  createdAt: string;
}

// ── Timeline view (derived from event nodes) ────────────────────────────────

export interface StoryTimelineEntry {
  id: string;
  name: string;
  description: string;
  kind: StoryEventKind;
  chapterRef: string | null;
  order: number;
  characters: string[];
  location: string | null;
}

export interface StoryTimelineView {
  storyId: string;
  entries: StoryTimelineEntry[];
}

// ── Request ─────────────────────────────────────────────────────────────────

/** `POST /story-intelligence/:storyId/analyze`. */
export interface AnalyzeStoryRequest {
  kind: StoryAnalysisKind;
  scope: StoryAnalysisScope;
  /** The chapter/scene/book text to analyse (client-supplied — offline/unsaved safe). */
  content: string;
  chapterRef?: string;
  storyTitle?: string;
}

/** `POST /story-intelligence/:storyId/map/stream` — build the whole map in one run (D5). */
export interface MapStoryRequest {
  /** The full story text to map (client-supplied — offline/unsaved safe). */
  content: string;
  storyTitle?: string;
}

/**
 * The SSE frames a map run emits (D5).
 *
 * Discriminated on `type`, not on the server's internal `kind`: `sendSse` stamps the event name onto
 * the payload as `type`, which is the AF1 wire every other stream on this platform speaks, so a
 * client parses these with the same transport it already has.
 *
 * A failure arrives as an `error` frame carrying a real domain code — most usefully
 * `QUOTA_EXCEEDED`, which the service raises BEFORE the first call by reserving the whole run, so a
 * writer without enough allowance is told up front rather than left with a half-built graph.
 */
export type StoryMapStreamEvent =
  | { type: 'progress'; step: number; total: number; analysis: StoryAnalysisKind }
  | { type: 'done'; completed: StoryAnalysisKind[] }
  | { type: 'error'; code: string; message: string };
