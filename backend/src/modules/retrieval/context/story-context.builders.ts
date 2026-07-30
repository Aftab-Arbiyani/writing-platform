import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from '../../../common/exceptions/app.exception';
import type { ContextFragment, ContextProvider } from '../../ai/context/context-builder.port';
import type { StoryGraphDto } from '../../story-intelligence/dto/story-response.dto';
import { StoryIntelligenceService } from '../../story-intelligence/story-intelligence.service';
import { truncateToTokens } from '../retrieval.text.util';

/**
 * Reusable context builders (AF4) that implement AF1's `ContextProvider` port — turning a
 * `{ type, params }` request into a graph-grounded prompt fragment. These make the story
 * knowledge graph injectable as CONTEXT into ANY AI feature (Writing Assistant, Craft
 * Coach, a future AI Editor), realising docs/35 §10: "future features inject the graph as
 * context instead of re-analysing." AF4's own consumers ground through the RetrievalService
 * pipeline; these builders are the reuse seam for everything else. They are registered
 * under `AI_CONTEXT_PROVIDERS` and exported; wiring them into AF1's ContextRegistryService
 * is a one-line seam (documented in docs/36) deferred only to avoid a module cycle (the
 * graph module already depends on the AI module).
 *
 * All are owner-scoped via the graph snapshot; a missing/foreign story yields no fragment
 * (null) rather than an error — context is best-effort by design.
 */

const MAX_PER_TYPE = 8;

/** type: `story_graph` — a compact digest of the whole graph grouped by node type. */
@Injectable()
export class StoryGraphContextBuilder implements ContextProvider {
  readonly type = 'story_graph';

  constructor(private readonly story: StoryIntelligenceService) {}

  async build(
    params: Record<string, unknown>,
    scope: { userId: string },
  ): Promise<ContextFragment | null> {
    const graph = await loadGraph(this.story, scope.userId, params.storyId);
    if (graph === null || graph.nodes.length === 0) return null;

    const byType = new Map<string, string[]>();
    for (const node of [...graph.nodes].sort((a, b) => b.mentionCount - a.mentionCount)) {
      const list = byType.get(node.type) ?? [];
      if (list.length < MAX_PER_TYPE) list.push(node.name);
      byType.set(node.type, list);
    }
    const lines = [...byType.entries()].map(
      ([type, names]) => `${cap(type)}s: ${names.join(', ')}`,
    );
    return { label: 'Story knowledge graph', text: truncateToTokens(lines.join('\n'), 400) };
  }
}

/** type: `story_characters` — characters + the relationships among them. */
@Injectable()
export class StoryCharactersContextBuilder implements ContextProvider {
  readonly type = 'story_characters';

  constructor(private readonly story: StoryIntelligenceService) {}

  async build(
    params: Record<string, unknown>,
    scope: { userId: string },
  ): Promise<ContextFragment | null> {
    const graph = await loadGraph(this.story, scope.userId, params.storyId);
    if (graph === null) return null;
    const characters = graph.nodes.filter((n) => n.type === 'character');
    if (characters.length === 0) return null;
    const charIds = new Set(characters.map((c) => c.id));
    const byId = new Map(characters.map((c) => [c.id, c.name]));

    const charLines = characters
      .slice(0, MAX_PER_TYPE)
      .map((c) => `${c.name}${c.summary !== '' ? ` — ${c.summary}` : ''}`);
    const relLines = graph.edges
      .filter(
        (e) => e.type === 'relationship' && charIds.has(e.sourceId) && charIds.has(e.targetId),
      )
      .slice(0, MAX_PER_TYPE)
      .map(
        (e) =>
          `${byId.get(e.sourceId)} ${e.label !== '' ? e.label : 'relates to'} ${byId.get(e.targetId)}`,
      );

    const text = [
      charLines.join('\n'),
      relLines.length > 0 ? `Relationships:\n${relLines.join('\n')}` : '',
    ]
      .filter((s) => s !== '')
      .join('\n');
    return { label: 'Characters', text: truncateToTokens(text, 400) };
  }
}

/** type: `story_timeline` — event nodes in chronological (story-time) order. */
@Injectable()
export class StoryTimelineContextBuilder implements ContextProvider {
  readonly type = 'story_timeline';

  constructor(private readonly story: StoryIntelligenceService) {}

  async build(
    params: Record<string, unknown>,
    scope: { userId: string },
  ): Promise<ContextFragment | null> {
    const graph = await loadGraph(this.story, scope.userId, params.storyId);
    if (graph === null) return null;
    const events = graph.nodes
      .filter((n) => n.type === 'event')
      .sort((a, b) => orderOf(a.data) - orderOf(b.data));
    if (events.length === 0) return null;
    const lines = events
      .slice(0, 12)
      .map((e, i) => `${i + 1}. ${e.name}${e.summary !== '' ? ` — ${e.summary}` : ''}`);
    return { label: 'Timeline', text: truncateToTokens(lines.join('\n'), 400) };
  }
}

async function loadGraph(
  story: StoryIntelligenceService,
  userId: string,
  rawStoryId: unknown,
): Promise<StoryGraphDto | null> {
  if (typeof rawStoryId !== 'string' || rawStoryId === '') return null;
  try {
    return await story.getGraphSnapshot(userId, rawStoryId);
  } catch (error) {
    if (error instanceof AppException && error.code === ERROR_CODES.STORY_NOT_FOUND) return null;
    throw error;
  }
}

function orderOf(data: Record<string, unknown>): number {
  return typeof data.order === 'number' && Number.isFinite(data.order) ? data.order : 0;
}

function cap(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}
