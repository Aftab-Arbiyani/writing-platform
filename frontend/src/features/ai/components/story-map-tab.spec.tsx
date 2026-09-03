import { ExplorerView } from '@qalam/shared';
import type {
  ExplorerViewResponse,
  StoryGraphEdge,
  StoryGraphNode,
  StoryMapStreamEvent,
} from '@qalam/api-types';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAiEditorTarget } from '@/stores/ai-editor-target.store';
import { ApiError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';

import { storyRetrievalApi } from '../api/story-retrieval.api';
import { StoryMapTab } from './story-map-tab';

vi.mock('../api/story-retrieval.api', () => ({
  storyRetrievalApi: { explore: vi.fn(), mapStory: vi.fn() },
}));
// The gate is AF1 meta and covered by the drawer's own spec; here the surface's behaviour is
// what is under test, so it resolves to `available` throughout.
vi.mock('../hooks/use-ai-meta', () => ({
  useAiFeatures: () => ({ data: { aiEnabled: true, features: [] } }),
}));

const explore = vi.mocked(storyRetrievalApi.explore);
const mapStory = vi.mocked(storyRetrievalApi.mapStory);

/** A finished map run, as the SSE transport yields it. */
async function* mapRun(): AsyncGenerator<StoryMapStreamEvent> {
  yield { type: 'progress', step: 1, total: 5, analysis: 'character' };
  yield { type: 'progress', step: 2, total: 5, analysis: 'plot' };
  yield { type: 'done', completed: ['character', 'plot'] };
}

/**
 * A run that STOPS after its first progress frame until released.
 *
 * `mapRun` above resolves every frame in one microtask flush, so the whole job is over before React
 * paints and the progress line never exists to be asserted. That is an artefact of the fixture, not
 * of the component — a real run takes five model calls — so the mid-run state needs a generator that
 * actually stays mid-run.
 */
function pausedMapRun(): {
  gen: () => AsyncGenerator<StoryMapStreamEvent>;
  release: () => void;
} {
  let release = (): void => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    gen: async function* () {
      yield { type: 'progress', step: 2, total: 5, analysis: 'plot' };
      await gate;
      yield { type: 'done', completed: ['character', 'plot'] };
    },
    release: () => {
      release();
    },
  };
}

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

describe('StoryMapTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    explore.mockResolvedValue(view());
    mapStory.mockImplementation(() => mapRun());
    // The map trigger reads the draft through the editor seam, so a registered target is part of
    // this surface's arrangement now — an unregistered one leaves nothing to map.
    useAiEditorTarget.setState({
      open: true,
      storyId: 'piece-1',
      target: {
        getContext: () => ({
          selectionText: '',
          documentText: 'The rain fell over the old city.',
          title: 'Barish',
          language: 'en',
          wordCount: 7,
        }),
        apply: () => true,
      },
    } as never);
  });

  it('opens on Characters and asks the server for that projection', async () => {
    renderWithProviders(<StoryMapTab storyId="piece-1" />);
    await waitFor(() => {
      expect(explore).toHaveBeenCalledWith('piece-1', ExplorerView.Characters, expect.anything());
    });
  });

  it('offers all eight views', () => {
    renderWithProviders(<StoryMapTab storyId="piece-1" />);
    for (const label of [
      'Characters',
      'Relationships',
      'Timeline',
      'Locations',
      'Events',
      'Objects',
      'Concepts',
      // D5 renamed this view. "Story map" is the FEATURE now, so a view sharing the name left the
      // writer unable to tell the tab from one of its own siblings.
      'Overview',
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
    renderWithProviders(<StoryMapTab storyId="piece-1" />);
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
    renderWithProviders(<StoryMapTab storyId="piece-1" />);

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
    renderWithProviders(<StoryMapTab storyId="piece-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Relationships' }));

    expect(
      await screen.findByText(
        'No relationships have been mapped between this story’s characters yet.',
      ),
    ).toBeInTheDocument();
  });

  it('says an empty overview has not been mapped, rather than naming a route nobody can reach', async () => {
    renderWithProviders(<StoryMapTab storyId="piece-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));

    // The old copy said "Analyse this story to build its knowledge graph" — an instruction with no
    // control anywhere on either client to carry it out (48 §3.22d). D5 shipped the control, so the
    // copy can now describe a state instead of asking for an impossible action.
    expect(await screen.findByText('This story hasn’t been mapped yet.')).toBeInTheDocument();
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
    renderWithProviders(<StoryMapTab storyId="piece-1" />);

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
    renderWithProviders(<StoryMapTab storyId="piece-1" />);

    fireEvent.click(await screen.findByRole('button', { name: /Aria/ }));
    // The edge label is the substance of the connection, so it is in the accessible name.
    fireEvent.click(screen.getByRole('button', { name: 'The mentor (mentored by)' }));

    expect(screen.getByText('Teaches, and lies.')).toBeInTheDocument();
  });

  it('returns to the list, and a view change drops a selection that view may not contain', async () => {
    explore.mockResolvedValue(view({ nodes: [node({ id: 'n1', name: 'Aria' })] }));
    renderWithProviders(<StoryMapTab storyId="piece-1" />);

    fireEvent.click(await screen.findByRole('button', { name: /Aria/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to list' }));
    expect(screen.getByRole('list', { name: 'Characters' })).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /Aria/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Locations' }));
    expect(screen.queryByRole('button', { name: 'Back to list' })).not.toBeInTheDocument();
  });

  it('offers a retry rather than a blank panel when the read fails', async () => {
    explore.mockRejectedValue(new Error('nope'));
    renderWithProviders(<StoryMapTab storyId="piece-1" />);

    expect(await screen.findByText('Couldn’t open the story map.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  /**
   * "Map this story" (D5) — the action that makes the seven views above capable of showing anything.
   *
   * Until this shipped, the graph had no writer: `POST /story-intelligence/:storyId/analyze` existed
   * and no client could reach it, so every view rendered its empty state on every story, forever
   * (48 §3.22d). These are the tests for the half that was missing, not for a refinement of the half
   * that was there.
   */
  describe('Map this story', () => {
    it('sends the draft’s live text and title, read at click time', async () => {
      renderWithProviders(<StoryMapTab storyId="piece-1" />);

      fireEvent.click(screen.getByRole('button', { name: /Map this story/ }));

      await waitFor(() => {
        expect(mapStory).toHaveBeenCalled();
      });
      // Read from the editor seam rather than held in state: a writer keeps typing, and mapping a
      // version they have moved on from would build a graph of a story that no longer exists.
      expect(mapStory.mock.calls[0]?.[0]).toBe('piece-1');
      expect(mapStory.mock.calls[0]?.[1]).toEqual({
        content: 'The rain fell over the old city.',
        storyTitle: 'Barish',
      });
    });

    it('reports which step it is on, not merely that it is busy', async () => {
      const paused = pausedMapRun();
      mapStory.mockImplementation(() => paused.gen());
      renderWithProviders(<StoryMapTab storyId="piece-1" />);

      fireEvent.click(screen.getByRole('button', { name: /Map this story/ }));

      // Five sequential model calls take long enough that a spinner is not an answer — the writer
      // needs to know it is moving and roughly how much is left.
      expect(await screen.findByText(/Step 2 of 5/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();

      paused.release();
      await waitFor(() => {
        expect(screen.queryByText(/Step 2 of 5/)).not.toBeInTheDocument();
      });
    });

    it('refreshes the views when the run finishes, so the map fills in', async () => {
      renderWithProviders(<StoryMapTab storyId="piece-1" />);
      await waitFor(() => {
        expect(explore).toHaveBeenCalledTimes(1);
      });

      fireEvent.click(screen.getByRole('button', { name: /Map this story/ }));

      // The run's real output is a change to a resource this page is already reading, so finishing
      // has to invalidate it — otherwise the writer watches five steps complete and sees nothing.
      await waitFor(() => {
        expect(explore.mock.calls.length).toBeGreaterThan(1);
      });
    });

    it('offers a re-map once the story already has a graph', async () => {
      explore.mockResolvedValue(view({ nodes: [node({ id: 'n1', name: 'Aria' })] }));
      renderWithProviders(<StoryMapTab storyId="piece-1" />);

      // Re-running folds into the existing graph rather than replacing it, and the label says so:
      // a writer who has added three chapters should not have to wonder whether this starts over.
      expect(await screen.findByRole('button', { name: /Re-map this story/ })).toBeInTheDocument();
    });

    it('surfaces a refusal raised BEFORE the first analysis, which is not a stream frame', async () => {
      // The pre-stream path: the service reserves the whole run and raises QUOTA_EXCEEDED up front,
      // so it arrives as an ordinary failure envelope rather than as an `error` event. A client
      // that only handled frames would show a run that silently did nothing.
      mapStory.mockImplementation(() =>
        // eslint-disable-next-line require-yield
        (async function* (): AsyncGenerator<StoryMapStreamEvent> {
          throw new ApiError(429, {
            code: 'QUOTA_EXCEEDED',
            message: 'You’ve used this month’s story analyses.',
          });
        })(),
      );
      renderWithProviders(<StoryMapTab storyId="piece-1" />);

      fireEvent.click(screen.getByRole('button', { name: /Map this story/ }));

      // Rendered through the app's shared error copy rather than the server's raw message, which
      // is what every other surface does — the writer gets one voice for a refusal, wherever it
      // came from.
      expect(await screen.findByRole('alert')).toHaveTextContent(/used your allowance/i);
    });

    it('offers nothing to map when the draft is empty', () => {
      useAiEditorTarget.setState({
        target: {
          getContext: () => ({
            selectionText: '',
            documentText: '   ',
            title: '',
            language: 'en',
            wordCount: 0,
          }),
          apply: () => true,
        },
      } as never);
      renderWithProviders(<StoryMapTab storyId="piece-1" />);

      expect(screen.getByRole('button', { name: /Map this story/ })).toBeDisabled();
    });
  });
});
