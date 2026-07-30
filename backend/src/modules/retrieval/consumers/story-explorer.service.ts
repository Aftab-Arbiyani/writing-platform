import { Injectable } from '@nestjs/common';
import { ExplorerView } from '@qalam/shared';

import type {
  StoryEdgeDto,
  StoryGraphDto,
  StoryNodeDto,
} from '../../story-intelligence/dto/story-response.dto';
import { StoryIntelligenceService } from '../../story-intelligence/story-intelligence.service';
import type { ExplorerViewResponseDto } from '../dto/retrieval-response.dto';

/** ExplorerView → the node type(s) it renders. Empty = all types (the full map). */
const VIEW_NODE_TYPES: Record<ExplorerView, string[]> = {
  [ExplorerView.Characters]: ['character'],
  [ExplorerView.Relationships]: ['character'],
  [ExplorerView.Timeline]: ['event'],
  [ExplorerView.Locations]: ['location'],
  [ExplorerView.Events]: ['event'],
  [ExplorerView.Objects]: ['object'],
  [ExplorerView.Concepts]: ['concept'],
  [ExplorerView.Map]: [],
};

/**
 * Story Explorer (AF4). Renders structured views over the AF3 knowledge graph — the SSOT —
 * with NO LLM and NO duplicated graph logic: it reads the owner-scoped graph snapshot once
 * (a foreign/missing story surfaces STORY_NOT_FOUND) and PROJECTS it per view. Every
 * explorer renders directly from graph node/edge objects (docs/36). Presentation owns
 * rendering; this returns the structured objects to render from.
 */
@Injectable()
export class StoryExplorerService {
  constructor(private readonly story: StoryIntelligenceService) {}

  async explore(
    userId: string,
    storyId: string,
    rawView: string,
  ): Promise<ExplorerViewResponseDto> {
    const view = normalizeView(rawView);
    const graph = await this.story.getGraphSnapshot(userId, storyId);
    const { nodes, edges } = project(graph, view);
    return {
      storyId,
      view,
      nodes,
      edges,
      stats: { nodeCount: nodes.length, edgeCount: edges.length },
    };
  }
}

function normalizeView(raw: string): ExplorerView {
  return (Object.values(ExplorerView) as string[]).includes(raw)
    ? (raw as ExplorerView)
    : ExplorerView.Map;
}

/** Project the graph into the requested view (typed node subset + the edges among them). */
function project(
  graph: StoryGraphDto,
  view: ExplorerView,
): { nodes: StoryNodeDto[]; edges: StoryEdgeDto[] } {
  if (view === ExplorerView.Map) {
    return { nodes: graph.nodes, edges: graph.edges };
  }

  if (view === ExplorerView.Relationships) {
    const characters = graph.nodes.filter((n) => n.type === 'character');
    const ids = new Set(characters.map((c) => c.id));
    const edges = graph.edges.filter(
      (e) => e.type === 'relationship' && ids.has(e.sourceId) && ids.has(e.targetId),
    );
    const connected = new Set<string>();
    edges.forEach((e) => {
      connected.add(e.sourceId);
      connected.add(e.targetId);
    });
    return { nodes: characters.filter((c) => connected.has(c.id)), edges };
  }

  const types = new Set(VIEW_NODE_TYPES[view]);
  let nodes = graph.nodes.filter((n) => types.has(n.type));
  if (view === ExplorerView.Timeline) {
    nodes = [...nodes].sort((a, b) => orderOf(a.data) - orderOf(b.data));
  }
  const ids = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter((e) => ids.has(e.sourceId) && ids.has(e.targetId));
  return { nodes, edges };
}

function orderOf(data: Record<string, unknown>): number {
  return typeof data.order === 'number' && Number.isFinite(data.order) ? data.order : 0;
}
