import { ERROR_CODES, POLICY_ACTIONS, SuggestionStatus } from '@qalam/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';

import { collaborationApi } from '../api/collaboration.api';
import type { EditSuggestion } from '../types/collaboration.types';
import { SuggestionCard } from './suggestion-card';

vi.mock('../api/collaboration.api');

const capabilities = vi.mocked(collaborationApi.capabilities);
const accept = vi.mocked(collaborationApi.acceptSuggestion);

function suggestion(over: Partial<EditSuggestion> = {}): EditSuggestion {
  return {
    id: 'sug-1',
    storyId: 'story-1',
    authorId: 'user-9',
    anchor: { from: 10, to: 20 },
    originalText: 'the old wording',
    suggestedText: 'the new wording',
    status: SuggestionStatus.Pending,
    resolvedById: null,
    resolvedAt: null,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

describe('SuggestionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capabilities.mockResolvedValue({
      storyId: 'story-1',
      capabilities: [
        {
          action: POLICY_ACTIONS.SuggestionResolve,
          effect: 'allow',
          allowed: true,
          reason: 'OWNERSHIP',
          obligations: [],
        },
      ],
    });
  });

  it('shows both sides of the proposed change', async () => {
    renderWithProviders(<SuggestionCard storyId="story-1" suggestion={suggestion()} />);

    expect(screen.getByText('the old wording')).toBeInTheDocument();
    expect(screen.getByText('the new wording')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Accept' })).toBeInTheDocument();
  });

  it('surfaces SUGGESTION_CONFLICT as its own explained state, not a generic error', async () => {
    // The prose moved under the suggestion — an expected outcome, so it gets real words.
    accept.mockRejectedValue(
      new ApiError(409, { code: ERROR_CODES.SUGGESTION_CONFLICT, message: 'conflict' }),
    );

    renderWithProviders(<SuggestionCard storyId="story-1" suggestion={suggestion()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /text this suggestion replaces has changed/i,
    );
  });

  it('tells the writer that accepting DID change the piece', () => {
    // The server applies the edit (`f6827e0`), so the card must say the prose moved — the writer's
    // own text changed under them, which is the one thing they must not have to infer.
    //
    // This test asserted the opposite wording until **W3c-4** (docs/48 §3.4): the copy went stale
    // when the server started rewriting, and because the assertion matched the stale copy, the suite
    // stayed green while the UI was wrong. Hence the second expectation — the old sentence must be
    // gone, not merely joined by a new one.
    renderWithProviders(
      <SuggestionCard
        storyId="story-1"
        suggestion={suggestion({ status: SuggestionStatus.Accepted })}
      />,
    );

    expect(screen.getByText(/the replacement was applied to the piece/i)).toBeInTheDocument();
    expect(screen.queryByText(/apply the replacement in the editor/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
  });

  it('hides resolve actions when the server does not allow them', async () => {
    capabilities.mockResolvedValue({ storyId: 'story-1', capabilities: [] });

    renderWithProviders(<SuggestionCard storyId="story-1" suggestion={suggestion()} />);

    await waitFor(() => {
      expect(capabilities).toHaveBeenCalled();
    });
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
  });
});
