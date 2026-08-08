import { ExplorerView } from '@qalam/shared';
import type { ExplorerViewResponse, StoryGraphEdge, StoryGraphNode } from '@qalam/api-types';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { storyRetrievalApi } from '../api/story-retrieval.api';
import { StoryExplorerTab } from './story-explorer-tab';

vi.mock('../api/story-retrieval.api', () => ({ storyRetrievalApi: { explore: vi.fn() } }));
// The gate is AF1 meta and covered by the panel's own spec; here the surface's behaviour is
// what is under test, so it resolves to `available` throughout.
vi.mock('../hooks/use-ai-meta', () => ({
  useAiFeatures: () => ({ data: { aiEnabled: true, features: [] } }),
  useAiUsage: () => ({ data: undefined }),
}));

const explore = vi.mocked(storyRetrievalApi.explore);

function node(over: Partial<StoryGraphNode> & { id: string; name: string }): StoryGraphNode {
  return {
    type: 'character',
    aliases: [],
    summary: '',
    data: {},
    confidence: 0.9,
    mentionCount: 3,
    firstChapter: null,
    evidence: [],
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z',
    ...over,
  } as StoryGraphNode;
}

function edge(over: Partial<StoryGraphEdge> & { id: string }): StoryGraphEdge {
  return {
    type: 'relationship',
    sourceId: 'n1',
    targetId: 'n2',
    label: 'mentor of',
    data: {},
    confidence: 0.8,
    evidence: [],
    ...over,
  } as StoryGraphEdge;
}

function view(over: Partial<ExplorerViewResponse> = {}): ExplorerViewResponse {
  const nodes = over.nodes ?? [];
  const edges = over.edges ?? [];
  return {
    storyId: 'piece-1',
    view: ExplorerView.Characters,
    nodes,
    edges,
    stats: { nodeCount: nodes.length, edgeCount: edges.length },
    ...over,
  };
}

describe('StoryExplorerTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    explore.mockResolvedValue(view());
  });

  it('opens on Characters and asks the server for that projection', async () => {
    renderWithProviders(<StoryExplorerTab storyId="piece-1" />);
    await waitFor(() => {
      expect(explore).toHaveBeenCalledWith('piece-1', ExplorerView.Characters, expect.anything());
    });
  });

  it('offers all eight views', () => {
    renderWithProviders(<StoryExplorerTab storyId="piece-1" />);
    for (const label of [
      'Characters',
      'Relationships',
      'Timeline',
      'Locations',
      'Events',
      'Objects',
      'Concepts',
      'Story map',
    ]) {
      expect(screen.getByRole('button', { name: label, pressed: undefined })).toBeInTheDocument();
    }
  });

  /**
   * The point of the whole surface: the server PROJECTS per view rather than filtering one payload
   * (`relationships` drops unconnected characters, `timeline` arrives pre-sorted), so switching a
   * view must re-read. A client that filtered a cached graph would silently show the wrong set.
   */
  it('re-reads from the server when the view changes rather than filtering a cached graph', async () => {
    renderWithProviders(<StoryExplorerTab storyId="piece-1" />);
    await waitFor(() => {
      expect(explore).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }));

    await waitFor(() => {
      expect(explore).toHaveBeenCalledWith('piece-1', ExplorerView.Timeline, expect.anything());
    });
  });

  it('renders nodes in the server’s order and never re-sorts them', async () => {
    explore.mockResolvedValue(
      view({
        view: ExplorerView.Timeline,
        // Deliberately not alphabetical: the timeline is ordered by `data.order` server-side.
        nodes: [
          node({ id: 'n3', name: 'The wedding', type: 'event' }),
          node({ id: 'n1', name: 'A letter arrives', type: 'event' }),
          node({ id: 'n2', name: 'Bargain struck', type: 'event' }),
        ],
      }),
    );
    renderWithProviders(<StoryExplorerTab storyId="piece-1" />);

    const items = await screen.findAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('The wedding'),
      expect.stringContaining('A letter arrives'),
      expect.stringContaining('Bargain struck'),
    ]);
  });

  /**
   * `relationships` is not `characters` minus nothing — the server drops every character with no
   * relationship edge, so a full cast with no mapped relationships is legitimately empty here. Copy
   * that said "no characters" would send the writer looking for a bug that is not there.
   */
  it('explains an empty relationships view in its own terms, not as missing characters', async () => {
    renderWithProviders(<StoryExplorerTab storyId="piece-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Relationships' }));

    expect(
      await screen.findByText(
        'No relationships have been mapped between this story’s characters yet.',
      ),
    ).toBeInTheDocument();
  });

  it('points an empty story map at the analysis that would fill it', async () => {
    renderWithProviders(<StoryExplorerTab storyId="piece-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Story map' }));

    expect(
      await screen.findByText('Analyse this story to build its knowledge graph.'),
    ).toBeInTheDocument();
  });

  it('opens a node’s detail with its structured data and evidence', async () => {
    explore.mockResolvedValue(
      view({
        nodes: [
          node({
            id: 'n1',
            name: 'Aria',
            summary: 'A reluctant heir.',
            aliases: ['The heir'],
            data: { arc: 'reluctant to resolute', traits: ['stubborn', 'kind'] },
            evidence: [{ chapterRef: 'Ch. 2', quote: 'She would not be moved.' }],
          }),
        ],
      }),
    );
    renderWithProviders(<StoryExplorerTab storyId="piece-1" />);

    fireEvent.click(await screen.findByRole('button', { name: /Aria/ }));

    expect(screen.getByText('Also known as The heir')).toBeInTheDocument();
    expect(screen.getByText('Arc')).toBeInTheDocument();
    expect(screen.getByText('reluctant to resolute')).toBeInTheDocument();
    // An array `data` value reads as a list, not as "[object Object]".
    expect(screen.getByText('stubborn, kind')).toBeInTheDocument();
    expect(screen.getByText(/She would not be moved\./)).toBeInTheDocument();
  });

  it('walks the graph: a neighbour opens that neighbour’s detail', async () => {
    explore.mockResolvedValue(
      view({
        nodes: [
          node({ id: 'n1', name: 'Aria' }),
          node({ id: 'n2', name: 'The mentor', summary: 'Teaches, and lies.' }),
        ],
        edges: [edge({ id: 'e1', sourceId: 'n1', targetId: 'n2', label: 'mentored by' })],
      }),
    );
    renderWithProviders(<StoryExplorerTab storyId="piece-1" />);

    fireEvent.click(await screen.findByRole('button', { name: /Aria/ }));
    // The edge label is the substance of the connection, so it is in the accessible name.
    fireEvent.click(screen.getByRole('button', { name: 'The mentor (mentored by)' }));

    expect(screen.getByText('Teaches, and lies.')).toBeInTheDocument();
  });

  it('returns to the list, and a view change drops a selection that view may not contain', async () => {
    explore.mockResolvedValue(view({ nodes: [node({ id: 'n1', name: 'Aria' })] }));
    renderWithProviders(<StoryExplorerTab storyId="piece-1" />);

    fireEvent.click(await screen.findByRole('button', { name: /Aria/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to list' }));
    expect(screen.getByRole('list', { name: 'Characters' })).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /Aria/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Locations' }));
    expect(screen.queryByRole('button', { name: 'Back to list' })).not.toBeInTheDocument();
  });

  it('offers a retry rather than a blank panel when the read fails', async () => {
    explore.mockRejectedValue(new Error('nope'));
    renderWithProviders(<StoryExplorerTab storyId="piece-1" />);

    expect(await screen.findByText('Couldn’t open the story graph.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
