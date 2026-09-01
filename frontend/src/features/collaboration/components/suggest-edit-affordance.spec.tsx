import { POLICY_ACTIONS } from '@qalam/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/stores/auth.store';
import { useSuggestTarget } from '@/stores/suggest-target.store';

import { collaborationApi } from '../api/collaboration.api';
import { SuggestEditAffordance } from './suggest-edit-affordance';

vi.mock('../api/collaboration.api');
vi.mock('../lib/collaboration-enabled');

const { isCollaborationEnabled } = await import('../lib/collaboration-enabled');
const capabilities = vi.mocked(collaborationApi.capabilities);
const addSuggestion = vi.mocked(collaborationApi.addSuggestion);

const SELECTION = { from: 16, to: 22, text: 'second' };

function allowSuggesting(allowed: boolean): void {
  capabilities.mockResolvedValue({
    storyId: 'piece-1',
    capabilities: [
      {
        action: POLICY_ACTIONS.StorySuggest,
        effect: allowed ? 'allow' : 'deny',
        allowed,
        reason: 'OWNERSHIP',
        obligations: [],
      },
    ],
  });
}

describe('SuggestEditAffordance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSuggestTarget.getState().unregister();
    vi.mocked(isCollaborationEnabled).mockReturnValue(true);
    allowSuggesting(true);
    // Suggesting requires a session, and the reader is a PUBLIC page — so an authenticated status is
    // part of the arrangement, not a detail. See the anonymous case below for why.
    useAuthStore.setState({ status: 'authenticated' } as never);
  });

  afterEach(() => {
    useAuthStore.getState().clear();
  });

  it('renders nothing until a reader registers a story', () => {
    // Its whole state on every non-reader surface, which is why mounting it is harmless there.
    const { container } = renderWithProviders(<SuggestEditAffordance />);
    // `container` always holds the AntD provider div; what must be empty is what we rendered.
    expect(container.firstElementChild).toBeEmptyDOMElement();
  });

  it('renders nothing when collaboration is switched off', () => {
    vi.mocked(isCollaborationEnabled).mockReturnValue(false);
    useSuggestTarget.getState().register('piece-1');
    const { container } = renderWithProviders(<SuggestEditAffordance />);
    // `container` always holds the AntD provider div; what must be empty is what we rendered.
    expect(container.firstElementChild).toBeEmptyDOMElement();
  });

  it('renders nothing — and queries NOTHING — for a signed-out reader', async () => {
    // The regression this gate exists for, found by the first live browser run. The reader is public,
    // so this component mounts for everyone; `CapabilityGate`'s capability read is authenticated, and
    // a non-expiry 401 runs `onUnauthorized()` and drops the session. The visible symptom was five
    // signed-out conversation specs hanging on "Loading comments" — nowhere near the comments.
    //
    // Asserting the REQUEST is not made is the whole point: rendering null while still firing the
    // read would look correct here and still break the page.
    useAuthStore.setState({ status: 'anonymous' } as never);
    useSuggestTarget.getState().register('piece-1');
    const { container } = renderWithProviders(<SuggestEditAffordance />);

    expect(container.firstElementChild).toBeEmptyDOMElement();
    expect(capabilities).not.toHaveBeenCalled();
  });

  it('renders nothing when the Policy Engine says this viewer may not suggest', async () => {
    allowSuggesting(false);
    useSuggestTarget.getState().register('piece-1');
    renderWithProviders(<SuggestEditAffordance />);

    await waitFor(() => {
      expect(capabilities).toHaveBeenCalled();
    });
    expect(screen.queryByRole('button', { name: 'Suggest an edit' })).not.toBeInTheDocument();
  });

  it('turns the reader into picking mode, and back off again', async () => {
    useSuggestTarget.getState().register('piece-1');
    renderWithProviders(<SuggestEditAffordance />);

    fireEvent.click(await screen.findByRole('button', { name: 'Suggest an edit' }));
    expect(useSuggestTarget.getState().picking).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent('Pick the paragraph you want to change.');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(useSuggestTarget.getState().picking).toBe(false);
  });

  it('opens the composer on a selection, quoting the passage read-only', async () => {
    useSuggestTarget.getState().register('piece-1');
    renderWithProviders(<SuggestEditAffordance />);
    await screen.findByRole('button', { name: 'Suggest an edit' });

    useSuggestTarget.getState().select(SELECTION);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    // Read-only: an editable copy of the anchor's own text would drift into a guaranteed conflict.
    expect(screen.getByText('second').tagName).toBe('BLOCKQUOTE');
  });

  it('sends the anchor the READER computed — no offset is ever typed', async () => {
    addSuggestion.mockResolvedValue({ id: 'sug-1' } as never);
    useSuggestTarget.getState().register('piece-1');
    renderWithProviders(<SuggestEditAffordance />);
    await screen.findByRole('button', { name: 'Suggest an edit' });
    useSuggestTarget.getState().select(SELECTION);

    fireEvent.change(await screen.findByLabelText('Your suggested wording'), {
      target: { value: '  the better wording  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send suggestion' }));

    await waitFor(() => {
      expect(addSuggestion).toHaveBeenCalledWith('piece-1', {
        anchor: { from: 16, to: 22 },
        originalText: 'second',
        suggestedText: 'the better wording',
      });
    });
  });

  it('leaves picking mode after a successful send, and closes the composer', async () => {
    addSuggestion.mockResolvedValue({ id: 'sug-1' } as never);
    useSuggestTarget.getState().register('piece-1');
    renderWithProviders(<SuggestEditAffordance />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suggest an edit' }));
    useSuggestTarget.getState().select(SELECTION);

    fireEvent.change(await screen.findByLabelText('Your suggested wording'), {
      target: { value: 'better' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send suggestion' }));

    await waitFor(() => {
      expect(useSuggestTarget.getState().selection).toBeNull();
    });
    expect(useSuggestTarget.getState().picking).toBe(false);
  });

  it('refuses to send an empty suggestion', async () => {
    useSuggestTarget.getState().register('piece-1');
    renderWithProviders(<SuggestEditAffordance />);
    await screen.findByRole('button', { name: 'Suggest an edit' });
    useSuggestTarget.getState().select(SELECTION);

    expect(await screen.findByRole('button', { name: 'Send suggestion' })).toBeDisabled();
    expect(addSuggestion).not.toHaveBeenCalled();
  });

  it('keeps the composer open when the send fails, so the wording is not lost', async () => {
    addSuggestion.mockRejectedValue(new Error('nope'));
    useSuggestTarget.getState().register('piece-1');
    renderWithProviders(<SuggestEditAffordance />);
    await screen.findByRole('button', { name: 'Suggest an edit' });
    useSuggestTarget.getState().select(SELECTION);

    fireEvent.change(await screen.findByLabelText('Your suggested wording'), {
      target: { value: 'better' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send suggestion' }));

    await waitFor(() => {
      expect(addSuggestion).toHaveBeenCalled();
    });
    // A conflict is an expected outcome here (the prose moved). Dropping the draft on failure would
    // make the reader retype it to find out whether it was the anchor or the text that was wrong.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Your suggested wording')).toHaveValue('better');
  });
});
