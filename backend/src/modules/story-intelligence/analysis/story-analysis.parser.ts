import {
  StoryAnalysisKind,
  StoryAnalysisStatus,
  StoryEdgeType,
  StoryEventKind,
  StoryNodeType,
} from '@qalam/shared';

import type { EdgeUpsert, NodeUpsert, ParsedAnalysis } from '../story.types';
import {
  asArray,
  asConfidence,
  asEvidence,
  asObject,
  asScore,
  asString,
  asStringArray,
  asStringOrNull,
  extractJsonObject,
  isRecord,
} from './json.util';

/**
 * Turn a model's analysis response into STRUCTURED domain objects + graph upserts
 * (AF3). Structured first, prose second: each kind builds a `structured` payload and
 * the node/edge upserts that feed the knowledge graph; `summary`/`recommendations` are
 * fields, never the whole answer. Parsing is defensive (json.util) — an unparseable
 * response degrades to `status: failed` with the raw text retained, never a crash and
 * never plain-text-as-truth. Pure (no I/O), so it is unit-tested directly.
 */
export function parseStoryAnalysis(kind: StoryAnalysisKind, raw: string): ParsedAnalysis {
  const obj = extractJsonObject(raw);
  if (obj === null) {
    return {
      status: StoryAnalysisStatus.Failed,
      summary: '',
      recommendations: [],
      confidenceScore: 0,
      evidence: [],
      affectedChapters: [],
      affectedCharacters: [],
      structured: {},
      rawOutput: raw,
      nodes: [],
      edges: [],
    };
  }

  const env = readEnvelope(obj);
  const { structured, nodes, edges, affectedCharacters } = byKind(kind, obj, env.confidenceScore);

  const mergedCharacters = dedupe([...env.affectedCharacters, ...affectedCharacters]);
  // Structured payload present but thin → still Completed; the graph write is the point.
  const status = StoryAnalysisStatus.Completed;

  return {
    status,
    summary: env.summary,
    recommendations: env.recommendations,
    confidenceScore: env.confidenceScore,
    evidence: env.evidence,
    affectedChapters: env.affectedChapters,
    affectedCharacters: mergedCharacters,
    structured,
    rawOutput: null,
    nodes,
    edges,
  };
}

interface Envelope {
  summary: string;
  recommendations: string[];
  confidenceScore: number;
  evidence: ReturnType<typeof asEvidence>;
  affectedChapters: string[];
  affectedCharacters: string[];
}

function readEnvelope(obj: Record<string, unknown>): Envelope {
  return {
    summary: asString(obj.summary),
    recommendations: asStringArray(obj.recommendations),
    confidenceScore: asConfidence(obj.confidence ?? obj.confidenceScore),
    evidence: asEvidence(obj.evidence),
    affectedChapters: asStringArray(obj.affectedChapters),
    affectedCharacters: asStringArray(obj.affectedCharacters),
  };
}

interface KindResult {
  structured: Record<string, unknown>;
  nodes: NodeUpsert[];
  edges: EdgeUpsert[];
  affectedCharacters: string[];
}

function byKind(
  kind: StoryAnalysisKind,
  obj: Record<string, unknown>,
  confidence: number,
): KindResult {
  switch (kind) {
    case StoryAnalysisKind.Character:
      return parseCharacter(obj, confidence);
    case StoryAnalysisKind.Plot:
      return parsePlot(obj, confidence);
    case StoryAnalysisKind.World:
      return parseWorld(obj, confidence);
    case StoryAnalysisKind.Style:
      return parseStyle(obj);
    case StoryAnalysisKind.Timeline:
      return parseTimeline(obj, confidence);
  }
}

// ── Character ────────────────────────────────────────────────────────────────

function parseCharacter(obj: Record<string, unknown>, confidence: number): KindResult {
  const characters = asArray(obj.characters)
    .filter(isRecord)
    .map((c) => ({
      name: asString(c.name),
      aliases: asStringArray(c.aliases),
      role: asString(c.role, 'supporting'),
      traits: asStringArray(c.traits),
      goals: asStringArray(c.goals),
      motivations: asStringArray(c.motivations),
      arc: asString(c.arc),
      growth: asString(c.growth),
      firstChapter: asStringOrNull(c.firstChapter),
      evidence: asEvidence(c.evidence),
    }))
    .filter((c) => c.name !== '');

  const relationships = asArray(obj.relationships)
    .filter(isRecord)
    .map((r) => ({
      from: asString(r.from),
      to: asString(r.to),
      type: asString(r.type, 'related'),
      description: asString(r.description),
      evidence: asEvidence(r.evidence),
    }))
    .filter((r) => r.from !== '' && r.to !== '');

  const nodes: NodeUpsert[] = characters.map((c) => ({
    type: StoryNodeType.Character,
    name: c.name,
    aliases: c.aliases,
    summary: c.arc !== '' ? c.arc : c.growth,
    data: {
      role: c.role,
      traits: c.traits,
      goals: c.goals,
      motivations: c.motivations,
      arc: c.arc,
      growth: c.growth,
    },
    confidence,
    mentionCount: 1,
    firstChapter: c.firstChapter,
    evidence: c.evidence,
  }));

  const edges: EdgeUpsert[] = relationships.map((r) => ({
    type: StoryEdgeType.Relationship,
    sourceType: StoryNodeType.Character,
    sourceName: r.from,
    targetType: StoryNodeType.Character,
    targetName: r.to,
    label: r.type,
    data: { description: r.description },
    confidence,
    evidence: r.evidence,
  }));

  return {
    structured: { characters, relationships },
    nodes,
    edges,
    affectedCharacters: characters.map((c) => c.name),
  };
}

// ── Plot ─────────────────────────────────────────────────────────────────────

function parsePlot(obj: Record<string, unknown>, confidence: number): KindResult {
  const structureObj = asObject(obj.structure);
  const acts = asArray(obj.acts ?? structureObj.acts)
    .filter(isRecord)
    .map((a) => ({
      name: asString(a.name),
      summary: asString(a.summary),
      scenes: asStringArray(a.scenes),
    }))
    .filter((a) => a.name !== '' || a.summary !== '');

  const scenes = asArray(obj.scenes)
    .filter(isRecord)
    .map((s) => ({
      title: asString(s.title),
      summary: asString(s.summary),
      chapterRef: asStringOrNull(s.chapterRef),
    }));

  const conflicts = asArray(obj.conflicts)
    .filter(isRecord)
    .map((c) => ({
      description: asString(c.description),
      kind: asString(c.kind, 'conflict'),
      evidence: asEvidence(c.evidence),
    }))
    .filter((c) => c.description !== '');

  const climaxObj = isRecord(obj.climax) ? obj.climax : null;
  const climax =
    climaxObj !== null
      ? {
          description: asString(climaxObj.description),
          chapterRef: asStringOrNull(climaxObj.chapterRef),
        }
      : null;

  const pacingObj = asObject(obj.pacing);
  const structured = {
    acts,
    scenes,
    conflicts,
    resolutions: asArray(obj.resolutions)
      .filter(isRecord)
      .map((r) => ({ description: asString(r.description), evidence: asEvidence(r.evidence) })),
    plotHoles: readIssues(obj.plotHoles),
    unresolvedThreads: readIssues(obj.unresolvedThreads),
    foreshadowing: asArray(obj.foreshadowing)
      .filter(isRecord)
      .map((f) => ({
        setup: asString(f.setup),
        payoff: asStringOrNull(f.payoff),
        evidence: asEvidence(f.evidence),
      })),
    climax,
    pacing: { assessment: asString(pacingObj.assessment), score: asScore(pacingObj.score) },
    narrativeArc: asString(obj.narrativeArc),
  };

  const nodes: NodeUpsert[] = [];
  if (climax !== null && climax.description !== '') {
    nodes.push(
      eventNode('Climax', climax.description, confidence, {
        kind: 'climax',
        chapterRef: climax.chapterRef,
      }),
    );
  }
  for (const c of conflicts) {
    nodes.push(
      eventNode(
        truncate(c.description, 250),
        c.description,
        confidence,
        { kind: c.kind },
        c.evidence,
      ),
    );
  }

  return { structured, nodes, edges: [], affectedCharacters: [] };
}

// ── World building ─────────────────────────────────────────────────────────────

function parseWorld(obj: Record<string, unknown>, confidence: number): KindResult {
  const nodes: NodeUpsert[] = [];

  const locations = mapNamed(obj.locations, (n) => ({ description: asString(n.description) }));
  const organizations = mapNamed(obj.organizations, (n) => ({
    description: asString(n.description),
  }));
  const objects = mapNamed(obj.objects, (n) => ({ significance: asString(n.significance) }));
  const magicSystems = mapNamed(obj.magicSystems, (n) => ({
    rules: asStringArray(n.rules),
    description: asString(n.description),
  }));
  const lore = asArray(obj.lore)
    .filter(isRecord)
    .map((l) => ({ title: asString(l.title), detail: asString(l.detail) }))
    .filter((l) => l.title !== '');
  const historicalEvents = mapNamed(obj.historicalEvents, (n) => ({
    description: asString(n.description),
    when: asStringOrNull(n.when),
  }));
  const terminology = asArray(obj.terminology)
    .filter(isRecord)
    .map((t) => ({ term: asString(t.term), definition: asString(t.definition) }))
    .filter((t) => t.term !== '');

  for (const l of locations) {
    nodes.push(entityNode(StoryNodeType.Location, l.name, l.description, confidence, {}));
  }
  for (const o of organizations) {
    nodes.push(entityNode(StoryNodeType.Organization, o.name, o.description, confidence, {}));
  }
  for (const o of objects) {
    nodes.push(entityNode(StoryNodeType.Object, o.name, o.significance, confidence, {}));
  }
  for (const m of magicSystems) {
    nodes.push(
      entityNode(StoryNodeType.Concept, m.name, m.description, confidence, {
        subtype: 'magic_system',
        rules: m.rules,
      }),
    );
  }
  for (const l of lore) {
    nodes.push(
      entityNode(StoryNodeType.Concept, l.title, l.detail, confidence, { subtype: 'lore' }),
    );
  }
  for (const h of historicalEvents) {
    nodes.push(eventNode(h.name, h.description, confidence, { kind: 'historical', when: h.when }));
  }
  for (const t of terminology) {
    nodes.push(
      entityNode(StoryNodeType.Concept, t.term, t.definition, confidence, { subtype: 'term' }),
    );
  }

  const structured = {
    locations,
    organizations,
    objects,
    magicSystems,
    lore,
    historicalEvents,
    terminology,
  };
  return { structured, nodes, edges: [], affectedCharacters: [] };
}

// ── Style ──────────────────────────────────────────────────────────────────────

function parseStyle(obj: Record<string, unknown>): KindResult {
  const metric = (v: unknown): { score: number; assessment: string } => {
    const o = asObject(v);
    return { score: asScore(o.score), assessment: asString(o.assessment) };
  };
  const dialogue = asObject(obj.dialogueBalance);
  const passive = asObject(obj.passiveVoice);
  const showTell = asObject(obj.showVsTell);
  const structured = {
    readability: metric(obj.readability),
    sentenceVariety: metric(obj.sentenceVariety),
    vocabulary: metric(obj.vocabulary),
    dialogueBalance: {
      dialoguePercent: asScore(dialogue.dialoguePercent),
      assessment: asString(dialogue.assessment),
    },
    descriptionDensity: { assessment: asString(asObject(obj.descriptionDensity).assessment) },
    passiveVoice: {
      count: Math.max(0, asScore(passive.count)),
      examples: asStringArray(passive.examples),
    },
    showVsTell: {
      assessment: asString(showTell.assessment),
      tellingExamples: asStringArray(showTell.tellingExamples),
    },
    repetition: asArray(obj.repetition)
      .filter(isRecord)
      .map((r) => ({ phrase: asString(r.phrase), count: Math.max(0, asScore(r.count)) }))
      .filter((r) => r.phrase !== ''),
    consistency: readIssues(obj.consistency),
  };
  // Style analyses assess prose, not story entities → no node/edge writes.
  return { structured, nodes: [], edges: [], affectedCharacters: [] };
}

// ── Timeline ─────────────────────────────────────────────────────────────────

function parseTimeline(obj: Record<string, unknown>, confidence: number): KindResult {
  const events = asArray(obj.events)
    .filter(isRecord)
    .map((e, i) => ({
      name: asString(e.name),
      description: asString(e.description),
      kind: readEventKind(e.kind),
      chapterRef: asStringOrNull(e.chapterRef),
      order: Number.isFinite(e.order) ? asScore(e.order) : i,
      characters: asStringArray(e.characters),
      location: asStringOrNull(e.location),
      evidence: asEvidence(e.evidence),
    }))
    .filter((e) => e.name !== '');

  const ordered = [...events].sort((a, b) => a.order - b.order);
  const nodes: NodeUpsert[] = ordered.map((e) =>
    eventNode(
      e.name,
      e.description,
      confidence,
      {
        kind: e.kind,
        order: e.order,
        chapterRef: e.chapterRef,
        characters: e.characters,
        location: e.location,
      },
      e.evidence,
    ),
  );

  const edges: EdgeUpsert[] = [];
  for (const e of ordered) {
    if (e.location !== null) {
      edges.push({
        type: StoryEdgeType.OccursAt,
        sourceType: StoryNodeType.Event,
        sourceName: e.name,
        targetType: StoryNodeType.Location,
        targetName: e.location,
        label: 'occurs at',
        data: {},
        confidence,
        evidence: [],
      });
    }
    for (const character of e.characters) {
      edges.push({
        type: StoryEdgeType.Involves,
        sourceType: StoryNodeType.Event,
        sourceName: e.name,
        targetType: StoryNodeType.Character,
        targetName: character,
        label: 'involves',
        data: {},
        confidence,
        evidence: [],
      });
    }
  }
  for (let i = 0; i < ordered.length - 1; i++) {
    const from = ordered[i];
    const to = ordered[i + 1];
    if (from === undefined || to === undefined) {
      continue;
    }
    edges.push({
      type: StoryEdgeType.Precedes,
      sourceType: StoryNodeType.Event,
      sourceName: from.name,
      targetType: StoryNodeType.Event,
      targetName: to.name,
      label: 'precedes',
      data: {},
      confidence,
      evidence: [],
    });
  }

  return {
    structured: { events: ordered },
    nodes,
    edges,
    affectedCharacters: dedupe(ordered.flatMap((e) => e.characters)),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function readIssues(value: unknown): Array<{
  title: string;
  detail: string;
  severity: string;
  evidence: ReturnType<typeof asEvidence>;
}> {
  return asArray(value)
    .filter(isRecord)
    .map((i) => ({
      title: asString(i.title),
      detail: asString(i.detail ?? i.description),
      severity: normalizeSeverity(asString(i.severity, 'minor')),
      evidence: asEvidence(i.evidence),
    }))
    .filter((i) => i.title !== '' || i.detail !== '');
}

function normalizeSeverity(value: string): string {
  const v = value.toLowerCase();
  if (v === 'major' || v === 'critical' || v === 'high') return 'major';
  if (v === 'info' || v === 'low') return 'info';
  return 'minor';
}

function readEventKind(value: unknown): StoryEventKind {
  const v = asString(value).toLowerCase();
  if (v === StoryEventKind.Flashback) return StoryEventKind.Flashback;
  if (v === StoryEventKind.Future) return StoryEventKind.Future;
  return StoryEventKind.Chronological;
}

function mapNamed<T>(
  value: unknown,
  extra: (n: Record<string, unknown>) => T,
): Array<{ name: string } & T> {
  return asArray(value)
    .filter(isRecord)
    .map((n) => ({ name: asString(n.name), ...extra(n) }))
    .filter((n) => n.name !== '');
}

function entityNode(
  type: StoryNodeType,
  name: string,
  summary: string,
  confidence: number,
  data: Record<string, unknown>,
): NodeUpsert {
  return {
    type,
    name,
    aliases: [],
    summary,
    data,
    confidence,
    mentionCount: 1,
    firstChapter: null,
    evidence: [],
  };
}

function eventNode(
  name: string,
  summary: string,
  confidence: number,
  data: Record<string, unknown>,
  evidence: ReturnType<typeof asEvidence> = [],
): NodeUpsert {
  return {
    type: StoryNodeType.Event,
    name,
    aliases: [],
    summary,
    data,
    confidence,
    mentionCount: 1,
    firstChapter: null,
    evidence,
  };
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter((v) => v !== ''))];
}
