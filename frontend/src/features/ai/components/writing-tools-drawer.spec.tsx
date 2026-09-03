import { AiFeature } from '@qalam/shared';
import type { AiFeaturesResponse } from '@qalam/api-types';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { useAiEditorTarget, type AiEditorTarget } from '@/stores/ai-editor-target.store';
import { renderWithProviders } from '@/test/render';

import { useAiFeatures } from '../hooks/use-ai-meta';
import { useAiStreamStore } from '../stores/ai-stream.store';
import { WritingToolsDrawer } from './writing-tools-drawer';

vi.mock('../hooks/use-ai-meta', () => ({ useAiFeatures: vi.fn() }));
// The stream itself is AF1 and already covered; here we drive the store directly so the drawer's
// own behaviour (gating, accept/discard) is what is under test.
const start = vi.fn();
vi.mock('../hooks/use-ai-completion', () => ({
  useAiStream: () => ({ start, cancel: vi.fn() }),
  useAiCompletion: () => ({ mutate: vi.fn() }),
}));

const FEATURES: AiFeaturesResponse = {
  aiEnabled: true,
  userAiEnabled: true,
  features: [
    {
      feature: AiFeature.WritingAssistant,
      flagKey: 'feature.ai.writingAssistant.enabled',
      enabled: true,
    },
    { feature: AiFeature.CraftCoach, flagKey: 'feature.ai.craftCoach.enabled', enabled: true },
  ],
};

const apply = vi.fn().mockReturnValue(true);

/**
 * Renders the drawer with PASS-THROUGH gates.
 *
 * The gates themselves are monetization's `PremiumGate`, supplied by `app/routes/write.tsx` and
 * covered by `write-route-gate.spec.tsx` — these tests are about the drawer's own behaviour, so the
 * seams are held open here rather than exercised. Both props are REQUIRED (`writingGate` for D3,
 * `storyMapGate` for D4), so a future test cannot forget either exists.
 */
function renderDrawer(
  writingGate: (children: ReactNode) => ReactNode = (children) => children,
  storyMapGate: (children: ReactNode) => ReactNode = (children) => children,
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <WritingToolsDrawer writingGate={writingGate} storyMapGate={storyMapGate} />,
  );
}

function mockMeta(features: AiFeaturesResponse | undefined) {
  vi.mocked(useAiFeatures).mockReturnValue({ data: features } as ReturnType<typeof useAiFeatures>);
}

function registerTarget(
  over: Partial<ReturnType<AiEditorTarget['getContext']>> = {},
  storyId: string | null = null,
): void {
  useAiEditorTarget.setState({
    open: true,
    storyId,
    target: {
      getContext: () => ({
        selectionText: '',
        documentText: 'The whole draft.',
        title: 'A door',
        language: 'en',
        wordCount: 3,
        ...over,
      }),
      apply,
    },
  });
}

describe('WritingToolsDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apply.mockReturnValue(true);
    useAiStreamStore.getState().reset();
    useAiEditorTarget.setState({ target: null, storyId: null, open: false });
    mockMeta(FEATURES);
  });

  it('renders nothing when no editor has registered', () => {
    useAiEditorTarget.setState({ open: true, target: null });
    renderDrawer();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /**
   * D5's shape, asserted as three tabs and two absences.
   *
   * The drawer used to offer four: Assistant, Craft Coach, Explorer, Ask. Ask My Book is gone
   * outright, and the other three were renamed for what they do rather than what runs them.
   */
  it('offers exactly Polish, Feedback and Story Map — and no Ask tab', () => {
    registerTarget({}, 'piece-1');
    renderDrawer();

    expect(screen.getByRole('tab', { name: 'Polish' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Feedback' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Story Map' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Ask' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('is titled for what it does, not for what runs it', () => {
    registerTarget();
    renderDrawer();
    expect(screen.getByText('Writing tools')).toBeInTheDocument();
  });

  it('offers the one-click Polish actions once an editor is registered', () => {
    registerTarget();
    renderDrawer();
    expect(screen.getByRole('button', { name: 'Simplify' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Condense' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Improve' })).toBeInTheDocument();
  });

  /**
   * The five removed actions, asserted where a writer would look for them. The type makes them
   * uncallable; this makes them unreachable, which is the claim D5 actually made to the audience.
   */
  it('offers no way to GENERATE prose — only to transform what is there', () => {
    registerTarget();
    renderDrawer();

    for (const gone of ['Continue writing', 'Rewrite', 'Expand', 'Set tone', 'Send']) {
      expect(screen.queryByRole('button', { name: gone })).not.toBeInTheDocument();
    }
    // The freeform box went with them: there is no field here to type an instruction into.
    expect(screen.queryByLabelText('Ask AI')).not.toBeInTheDocument();
  });

  it('sends the action’s prompt key and the document as the operand', async () => {
    registerTarget();
    renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: 'Condense' }));

    await waitFor(() => {
      expect(start).toHaveBeenCalled();
    });
    expect(start.mock.calls[0]?.[0]).toMatchObject({
      feature: AiFeature.WritingAssistant,
      promptKey: 'writing_assistant.condense',
      messages: [{ role: 'user', content: 'The whole draft.' }],
    });
  });

  it('tells the writer whether it is working on the selection or the whole draft', () => {
    registerTarget({ selectionText: 'a phrase' });
    renderDrawer();
    expect(screen.getByText('Working on your selection.')).toBeInTheDocument();
  });

  /** D5 decision 9: every tool says how it works, quietly, at its foot. */
  it('discloses the model on the tab the writer is looking at', () => {
    registerTarget();
    renderDrawer();
    expect(screen.getByTestId('model-disclosure')).toBeInTheDocument();
  });

  it('walls off the surface when the feature flag is down', () => {
    mockMeta({
      aiEnabled: true,
      userAiEnabled: true,
      features: [
        {
          feature: AiFeature.WritingAssistant,
          flagKey: 'feature.ai.writingAssistant.enabled',
          enabled: false,
        },
      ],
    });
    registerTarget();
    renderDrawer();
    expect(screen.getByText('Not available yet')).toBeInTheDocument();
  });

  it('walls off the surface when a request comes back over quota mid-flight', () => {
    // D5 removed the PRE-FLIGHT quota read (a token rollup from a route that no longer exists), so
    // this reactive path is now the only way `quota` is ever reached — which makes it the case that
    // has to work.
    registerTarget();
    useAiStreamStore.setState({ status: 'error', errorCode: 'QUOTA_EXCEEDED' });
    renderDrawer();
    expect(screen.getByText('You’ve used this tool’s allowance')).toBeInTheDocument();
  });

  it('applies an accepted suggestion through the editor target, never directly', () => {
    registerTarget();
    useAiStreamStore.setState({ status: 'done', text: 'A suggested line.' });
    renderDrawer();

    // No selection, so a one-click accept inserts below rather than replacing the draft.
    fireEvent.click(screen.getByRole('button', { name: /Insert below/ }));
    expect(apply).toHaveBeenCalledWith('A suggested line.', 'insert-below');
  });

  it('discards a suggestion without touching the document', () => {
    registerTarget();
    useAiStreamStore.setState({ status: 'done', text: 'A suggested line.' });
    renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
    expect(apply).not.toHaveBeenCalled();
    expect(useAiStreamStore.getState().text).toBe('');
  });

  /**
   * Story Map takes the SERVER piece id and is owner-scoped server-side, so a draft that has never
   * synced has no story to map — the web reading of mobile's `st.draft.isRemote` gate
   * (`editor_screen.dart:245`).
   */
  it('hides Story Map until the draft has a server id', () => {
    registerTarget({}, null);
    renderDrawer();
    expect(screen.queryByRole('tab', { name: 'Story Map' })).not.toBeInTheDocument();
  });

  it('offers Story Map once the draft has synced', () => {
    registerTarget({}, 'piece-1');
    renderDrawer();
    expect(screen.getByRole('tab', { name: 'Story Map' })).toBeInTheDocument();
  });

  /**
   * D4 (decided 2026-08-21, docs/48 §5.2): `story_intelligence` is enforced server-side, so the
   * Story Map body goes through its own entitlement gate — a DIFFERENT one from the writing tools',
   * because the two denials name different plans.
   *
   * Asserted by counting the gate's sentinel: AntD mounts a tabpanel on first activation and then
   * keeps it mounted, so finding exactly one occurrence after visiting both is what proves one tab
   * is wrapped and the others are not.
   */
  it('puts ONLY the Story Map body behind the story-intelligence gate (D4)', () => {
    registerTarget({}, 'piece-1');
    renderDrawer(
      (children) => children,
      () => <p>story intelligence locked</p>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Story Map' }));
    expect(screen.getAllByText('story intelligence locked')).toHaveLength(1);

    fireEvent.click(screen.getByRole('tab', { name: 'Feedback' }));
    expect(screen.getAllByText('story intelligence locked')).toHaveLength(1);
  });

  /**
   * Precedence, and it is the same order mobile applies: a writer whose instance has the platform
   * switched off cannot act on "this needs a paid plan", so availability answers first and the gate
   * never runs. Pinned because the two are independent and the wrong order is invisible in review.
   */
  it('says the tools are unavailable rather than offering a plan, when both would apply', () => {
    mockMeta({ aiEnabled: false, userAiEnabled: true, features: [] });
    registerTarget({}, 'piece-1');
    renderDrawer(
      (children) => children,
      () => <p>story intelligence locked</p>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Story Map' }));
    expect(screen.getAllByText('Writing tools aren’t available').length).toBeGreaterThan(0);
    expect(screen.queryByText('story intelligence locked')).not.toBeInTheDocument();
  });

  /**
   * Story Map's reads carry `ai.use` and no feature flag, and make no model call. Gating on a
   * neighbouring flag would hide a surface the server would have served — the mistake mobile's
   * editor calls out by name at `editor_screen.dart:241-244`.
   */
  it('offers Story Map even when every feature flag is down', () => {
    mockMeta({ aiEnabled: true, userAiEnabled: true, features: [] });
    registerTarget({}, 'piece-1');
    renderDrawer();
    expect(screen.getByRole('tab', { name: 'Story Map' })).toBeInTheDocument();
  });

  /** Reading the graph spends nothing, so another tool's spent allowance must not lock it. */
  it('keeps Story Map open when Polish has hit a wall mid-flight', () => {
    registerTarget({}, 'piece-1');
    useAiStreamStore.setState({ status: 'error', errorCode: 'QUOTA_EXCEEDED' });
    renderDrawer();

    // Polish is walled…
    expect(screen.getByText('You’ve used this tool’s allowance')).toBeInTheDocument();
    // …and Story Map still opens, because it opts out of the shared error code.
    fireEvent.click(screen.getByRole('tab', { name: 'Story Map' }));
    expect(screen.getByRole('tab', { name: 'Story Map' })).toHaveAttribute('aria-selected', 'true');
  });

  it('walls off Story Map when the platform is off entirely', () => {
    mockMeta({ aiEnabled: false, userAiEnabled: true, features: [] });
    registerTarget({}, 'piece-1');
    renderDrawer();

    fireEvent.click(screen.getByRole('tab', { name: 'Story Map' }));
    expect(screen.getAllByText('Writing tools aren’t available').length).toBeGreaterThan(0);
  });

  /**
   * B5's switch, as it reads after D5. The state used to be its own — "You turned AI off", with a
   * button to the settings page where the switch lived. That page is gone, so the copy folds into
   * the platform's and, crucially, promises nothing: a remedy pointing at a deleted route is worse
   * than no remedy (48 §3.6 is the same defect in the other direction).
   */
  it('gives a writer who turned AI off an honest refusal, not a dead remedy', () => {
    mockMeta({ aiEnabled: false, userAiEnabled: false, features: [] });
    registerTarget({}, 'piece-1');
    renderDrawer();

    for (const tab of ['Polish', 'Feedback', 'Story Map']) {
      fireEvent.click(screen.getByRole('tab', { name: tab }));
      expect(screen.getAllByText('Writing tools aren’t available').length).toBeGreaterThan(0);
      expect(screen.queryByRole('button', { name: /settings/i })).not.toBeInTheDocument();
    }
  });

  /**
   * D3, and the case the gate alone cannot cover: the entitlement can be revoked (or the payments
   * flag raised) BETWEEN the page load that resolved the gate and the generation itself. The
   * refusal arrives as a 402 on the STREAM, so it lands in `errorCode` rather than in the
   * entitlement snapshot, and it must read as the same wall the gate would have shown.
   */
  it('renders the writing-tools wall when a 402 arrives mid-STREAM, not the allowance wall', () => {
    registerTarget({}, 'piece-1');
    useAiStreamStore.setState({ status: 'error', errorCode: 'ENTITLEMENT_DENIED' });
    renderDrawer();

    expect(screen.getByText('Polish & feedback is on Plus and above')).toBeInTheDocument();
    expect(screen.queryByText('This needs a paid plan')).not.toBeInTheDocument();
    expect(screen.queryByText('You’ve used this tool’s allowance')).not.toBeInTheDocument();
  });

  it('keeps Feedback on the same mid-stream wall, since it is the same premium code', () => {
    registerTarget({}, 'piece-1');
    useAiStreamStore.setState({ status: 'error', errorCode: 'ENTITLEMENT_DENIED' });
    renderDrawer();

    fireEvent.click(screen.getByRole('tab', { name: 'Feedback' }));
    expect(screen.getAllByText('Polish & feedback is on Plus and above').length).toBeGreaterThan(0);
  });
});
