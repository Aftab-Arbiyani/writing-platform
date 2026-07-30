import { Injectable } from '@nestjs/common';
import { RetrievalQueryType } from '@qalam/shared';

/** Ordered pattern rules — first match wins. Deterministic query classification. */
const RULES: ReadonlyArray<{ type: RetrievalQueryType; pattern: RegExp }> = [
  {
    type: RetrievalQueryType.Relationship,
    pattern: /\b(relationship|related to|connection|between .+ and)\b/,
  },
  {
    type: RetrievalQueryType.Dialogue,
    pattern: /\b(said|say|says|saying|dialogue|conversation|talk(s|ed|ing)?)\b/,
  },
  { type: RetrievalQueryType.Quote, pattern: /\b(quote|line|phrase|passage)\b|["“”]/ },
  {
    type: RetrievalQueryType.Timeline,
    pattern: /\b(timeline|chronolog|before|after|order of events|sequence|when did)\b/,
  },
  { type: RetrievalQueryType.Event, pattern: /\b(event|happened|occurs?|battle|scene where)\b/ },
  {
    type: RetrievalQueryType.Character,
    pattern: /\b(character|who is|who are|protagonist|antagonist|hero|villain)\b/,
  },
  {
    type: RetrievalQueryType.Location,
    pattern: /\b(location|place|where is|city|kingdom|realm|setting)\b/,
  },
  {
    type: RetrievalQueryType.WorldBuilding,
    pattern: /\b(world|magic|system|lore|rule|organization|faction|object|artifact)\b/,
  },
  { type: RetrievalQueryType.Concept, pattern: /\b(theme|concept|motif|idea|meaning|symbol)\b/ },
  { type: RetrievalQueryType.Chapter, pattern: /\bchapter\b/ },
  { type: RetrievalQueryType.Scene, pattern: /\bscene\b/ },
];

/**
 * Query classification (AF4) — the second pipeline stage. Buckets a query into the
 * Semantic Search taxonomy (character/scene/chapter/location/timeline/event/relationship/
 * dialogue/quote/concept/world-building, else natural language). This biases which graph
 * node types and retrieval sources the planner prioritises. Deterministic + rule-based;
 * an explicit hint from the client short-circuits it.
 */
@Injectable()
export class QueryClassifierService {
  classify(query: string, explicit?: RetrievalQueryType): RetrievalQueryType {
    if (explicit !== undefined) return explicit;
    const q = query.trim().toLowerCase();
    if (q === '') return RetrievalQueryType.NaturalLanguage;
    for (const rule of RULES) {
      if (rule.pattern.test(q)) return rule.type;
    }
    return RetrievalQueryType.NaturalLanguage;
  }
}
