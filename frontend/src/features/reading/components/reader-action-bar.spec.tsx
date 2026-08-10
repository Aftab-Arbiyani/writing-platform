import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Route, Routes, useSearchParams } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

import { useEngagementActions } from '../hooks/use-engagement';
import type { PieceEngagement } from '../types/reading.types';
import { ReaderActionBar } from './reader-action-bar';

vi.mock('../hooks/use-engagement', () => ({ useEngagementActions: vi.fn() }));

const likeMutate = vi.fn();
const unlikeMutate = vi.fn();
const bookmarkMutate = vi.fn();
const shareMutate = vi.fn();

function mockActions(): void {
  const idle = { mutate: vi.fn(), isPending: false };
  vi.mocked(useEngagementActions).mockReturnValue({
    like: { ...idle, mutate: likeMutate },
    unlike: { ...idle, mutate: unlikeMutate },
    bookmark: { ...idle, mutate: bookmarkMutate },
    unbookmark: idle,
    share: { ...idle, mutate: shareMutate },
  } as unknown as ReturnType<typeof useEngagementActions>);
}

const ENGAGEMENT: PieceEngagement = {
  stats: { likes: 12, claps: 300, bookmarks: 4, comments: 0, responses: 2, shares: 1 },
  viewer: { hasLiked: false, clapCount: 0, hasBookmarked: false },
};

/** Stands in for the sign-in screen so a redirect (and what it carries) is observable. */
function LoginStub(): ReactElement {
  const [params] = useSearchParams();
  return <p>sign-in returnTo={params.get('returnTo')}</p>;
}

function render(engagement: PieceEngagement | undefined = ENGAGEMENT, isLoading = false) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/p/a-door"
        element={
          <ReaderActionBar
            pieceId="p1"
            pieceTitle="A door never opened"
            engagement={engagement}
            isLoading={isLoading}
            shareUrl="https://qalam.test/p/a-door"
            returnTo="/p/a-door"
          />
        }
      />
      <Route path={ROUTES.login} element={<LoginStub />} />
    </Routes>,
    { route: '/p/a-door' },
  );
}

describe('ReaderActionBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActions();
    useAuthStore.setState({ status: 'authenticated' });
  });

  it('renders nothing until engagement has loaded (no flash of zeroes)', () => {
    render(undefined, true);
    expect(screen.queryByLabelText('Engagement on this piece')).not.toBeInTheDocument();
  });

  it('likes the piece for a signed-in reader', () => {
    render();
    fireEvent.click(screen.getByRole('button', { name: 'Like this piece' }));
    expect(likeMutate).toHaveBeenCalled();
  });

  it('unlikes when the viewer has already liked', () => {
    render({ ...ENGAGEMENT, viewer: { ...ENGAGEMENT.viewer, hasLiked: true } });
    const button = screen.getByRole('button', { name: 'Unlike this piece' });
    expect(button).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(button);
    expect(unlikeMutate).toHaveBeenCalled();
    expect(likeMutate).not.toHaveBeenCalled();
  });

  it('routes an anonymous reader to sign-in instead of writing', () => {
    useAuthStore.setState({ status: 'anonymous' });
    render();

    fireEvent.click(screen.getByRole('button', { name: 'Bookmark this piece' }));

    expect(bookmarkMutate).not.toHaveBeenCalled();
    // The redirect carries the piece, so signing in returns the reader to what they were reading.
    expect(screen.getByText('sign-in returnTo=/p/a-door')).toBeInTheDocument();
  });

  it('copies the canonical link and records the share — no sign-in required', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    useAuthStore.setState({ status: 'anonymous' });
    render();

    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this piece' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('https://qalam.test/p/a-door');
    });
    await waitFor(() => {
      expect(shareMutate).toHaveBeenCalled();
    });
  });

  /**
   * W7b turned the clap from a read-only stat into a gesture, so this assertion is the inverse of
   * what it used to be: the clap is a real BUTTON now, and only the responses count is still a stat
   * (and only because W7a put the responses themselves on the same page).
   */
  it('renders the clap as an action and the responses count as a stat', () => {
    render();
    expect(screen.getByRole('button', { name: 'Clap for this piece' })).toBeInTheDocument();
    expect(screen.getByLabelText('2 responses')).toBeInTheDocument();
    // The clap total is on the button, not in a separate read-only label.
    expect(screen.queryByLabelText('300 claps')).not.toBeInTheDocument();
  });

  it('offers save-to-collection and report behind the More menu', async () => {
    render();
    fireEvent.click(screen.getByRole('button', { name: 'More actions on this piece' }));
    expect(await screen.findByText('Save to a collection')).toBeInTheDocument();
    expect(screen.getByText('Report this piece')).toBeInTheDocument();
  });
});
