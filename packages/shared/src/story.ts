/**
 * Story Intelligence vocabulary (AF3) — the provider-agnostic domain language for the
 * structured **story knowledge graph** and the analyses that populate it. Like the rest
 * of `@qalam/shared` this is zero-dependency pure vocabulary: `as const` objects + union
 * types (JSON-safe wire strings), plus pure helpers. The graph is the single source of
 * truth every client renders from and every future AI feature reuses (docs/34 §13); this
 * file is the shared shape of that truth. Node/edge/kind sets are deliberately OPEN
 * (varchar + this catalogue) so a new entity kind never needs a migration.
 */

import { AiFeature } from './ai.js';

/** The analysis lenses. Each maps to a feature flag + a prompt template + graph writes. */
export const StoryAnalysisKind = {
  Character: 'character',
  Plot: 'plot',
  World: 'world',
  Style: 'style',
  Timeline: 'timeline',
} as const;
export type StoryAnalysisKind = (typeof StoryAnalysisKind)[keyof typeof StoryAnalysisKind];

/** How much of the story an analysis pass covers. */
export const StoryAnalysisScope = {
  Scene: 'scene',
  Chapter: 'chapter',
  Book: 'book',
} as const;
export type StoryAnalysisScope = (typeof StoryAnalysisScope)[keyof typeof StoryAnalysisScope];

/** Node kinds in the knowledge graph (OPEN set — new kinds need no migration). */
export const StoryNodeType = {
  Character: 'character',
  Location: 'location',
  Organization: 'organization',
  Object: 'object',
  Event: 'event',
  Concept: 'concept',
} as const;
export type StoryNodeType = (typeof StoryNodeType)[keyof typeof StoryNodeType];

/** Edge kinds in the knowledge graph (OPEN set). */
export const StoryEdgeType = {
  /** Character ↔ character (data.kind carries ally/rival/family/…). */
  Relationship: 'relationship',
  /** Entity is mentioned by/near another. */
  Mention: 'mention',
  /** Entity appears in an event/scene. */
  AppearsIn: 'appears_in',
  /** Event occurs at a location. */
  OccursAt: 'occurs_at',
  /** Event involves a character. */
  Involves: 'involves',
  /** Event chronologically precedes another (timeline order). */
  Precedes: 'precedes',
  /** Event/detail foreshadows a later event. */
  Foreshadows: 'foreshadows',
  /** Character is a member of an organization. */
  MemberOf: 'member_of',
} as const;
export type StoryEdgeType = (typeof StoryEdgeType)[keyof typeof StoryEdgeType];

/** Where an event sits on the reading vs. story timeline. */
export const StoryEventKind = {
  Chronological: 'chronological',
  Flashback: 'flashback',
  Future: 'future',
} as const;
export type StoryEventKind = (typeof StoryEventKind)[keyof typeof StoryEventKind];

/** Outcome of an analysis run (structured parse success level). */
export const StoryAnalysisStatus = {
  /** Structured objects fully recovered. */
  Completed: 'completed',
  /** Some structure recovered; a raw fallback is retained. */
  Partial: 'partial',
  /** No structure recovered; only the raw text is stored. */
  Failed: 'failed',
} as const;
export type StoryAnalysisStatus = (typeof StoryAnalysisStatus)[keyof typeof StoryAnalysisStatus];

/** Severity for a detected issue (plot hole, inconsistency, unresolved thread). */
export const StoryIssueSeverity = {
  Info: 'info',
  Minor: 'minor',
  Major: 'major',
} as const;
export type StoryIssueSeverity = (typeof StoryIssueSeverity)[keyof typeof StoryIssueSeverity];

/** Character role (OPEN-ish; drives graph presentation). */
export const CharacterRole = {
  Protagonist: 'protagonist',
  Antagonist: 'antagonist',
  Deuteragonist: 'deuteragonist',
  Supporting: 'supporting',
  Minor: 'minor',
  Mentor: 'mentor',
  Foil: 'foil',
  Narrator: 'narrator',
} as const;
export type CharacterRole = (typeof CharacterRole)[keyof typeof CharacterRole];

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Which AiFeature (and therefore which flag) gates a given analysis kind. */
const FEATURE_BY_KIND: Record<StoryAnalysisKind, AiFeature> = {
  [StoryAnalysisKind.Character]: AiFeature.CharacterAnalysis,
  [StoryAnalysisKind.Plot]: AiFeature.PlotAnalysis,
  [StoryAnalysisKind.World]: AiFeature.WorldBuilding,
  [StoryAnalysisKind.Style]: AiFeature.StyleAnalysis,
  [StoryAnalysisKind.Timeline]: AiFeature.StoryTimeline,
};

/** The AI feature that gates an analysis kind. */
export function storyAnalysisFeature(kind: StoryAnalysisKind): AiFeature {
  return FEATURE_BY_KIND[kind];
}

/** The server prompt-template key for an analysis kind (its BODY lives only on the server). */
export function storyAnalysisPromptKey(kind: StoryAnalysisKind): string {
  return `story.${kind}`;
}

/** Normalize an entity name for dedupe/upsert (case + whitespace folded). */
export function normalizeStoryName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Guardrail: max input characters for one analysis pass (server clamps too). */
export const STORY_ANALYSIS_MAX_INPUT_CHARS = 60_000;

/** Guardrail: cap on nodes per graph (defensive against runaway upserts). */
export const STORY_GRAPH_MAX_NODES = 5_000;

/** Guardrail: title length for a story graph. */
export const STORY_GRAPH_TITLE_MAX = 200;
