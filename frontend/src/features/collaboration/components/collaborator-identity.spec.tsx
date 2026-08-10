import { PresenceState } from '@qalam/shared';
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { get } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';

import type { StoryPresence } from '../types/collaboration.types';
import { CollaboratorIdentity } from './collaborator-identity';
import { PresenceBar } from './presence-bar';

vi.mock('@/lib/api-client');

const apiGet = vi.mocked(get);

const ALICE = '11111111-1111-1111-1111-111111111111';
const BOB = '22222222-2222-2222-2222-222222222222';

/** Only the fields the identity surfaces read; the wire DTO is much wider. */
function profile(over: Record<string, unknown> = {}): unknown {
  return {
    id: ALICE,
    username: 'alice',
    penName: 'Alice Q',
    avatarKey: null,
    restricted: false,
    counts: { followers: 0, following: 0, piecesPublished: 0 },
    ...over,
  };
}

describe('CollaboratorIdentity (B3 — resolve a bare id to a real person)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * The whole point of B3. Before it, this surface had nothing to resolve *from* and rendered
   * `1111…1111` to real users on every W3c screen.
   */
  it('resolves a bare user id to the real pen name through GET /users/by-id/:id', async () => {
    apiGet.mockResolvedValue(profile());
    renderWithProviders(<CollaboratorIdentity userId={ALICE} />);

    expect(await screen.findByText('Alice Q')).toBeInTheDocument();
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith(`/users/by-id/${ALICE}`, expect.anything());
  });

  /** The honest fallback: a deleted account or a failed lookup still names the row. */
  it('falls back to the short id when the lookup fails — never blank, never a fake name', async () => {
    apiGet.mockRejectedValue(new Error('USER_NOT_FOUND'));
    renderWithProviders(<CollaboratorIdentity userId={ALICE} />);

    expect(await screen.findByText('1111…1111')).toBeInTheDocument();
  });

  /** A private account returns a teaser, not a 404 — the pen name is still in it. */
  it('names a private account from its teaser', async () => {
    apiGet.mockResolvedValue(profile({ restricted: true, penName: 'Alice Q' }));
    renderWithProviders(<CollaboratorIdentity userId={ALICE} />);

    expect(await screen.findByText('Alice Q')).toBeInTheDocument();
  });

  it('shows "You" for the viewer’s own row without spending a request', async () => {
    apiGet.mockResolvedValue(profile());
    renderWithProviders(<CollaboratorIdentity userId={ALICE} isSelf />);

    expect(await screen.findByText('You')).toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
  });

  /**
   * The N+1 answer, asserted rather than assumed: cost is one request per DISTINCT user, not per
   * row. Four rows naming two people must not be four requests.
   */
  it('costs one request per distinct user, not per row', async () => {
    apiGet.mockImplementation((path: string) =>
      Promise.resolve(
        path.endsWith(BOB) ? profile({ id: BOB, username: 'bob', penName: 'Bob R' }) : profile(),
      ),
    );

    renderWithProviders(
      <>
        <CollaboratorIdentity userId={ALICE} />
        <CollaboratorIdentity userId={BOB} />
        <CollaboratorIdentity userId={ALICE} />
        <CollaboratorIdentity userId={BOB} />
      </>,
    );

    await screen.findAllByText('Alice Q');
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
  });
});

describe('PresenceBar identity (B3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // `StoryPresence` carries `lastSeenAt`, not `updatedAt` — and the `as` cast was hiding that
  // rather than satisfying it, so this file failed `tsc --noEmit` for the whole repo (found while
  // running W7a's gate; fixed here because the gate has to be green to mean anything).
  function entry(userId: string): StoryPresence {
    return {
      userId,
      state: PresenceState.Active,
      lastSeenAt: new Date('2026-08-08T10:00:00Z').toISOString(),
    };
  }

  it('names roster entries instead of showing a truncated id', async () => {
    apiGet.mockResolvedValue(profile());
    renderWithProviders(<PresenceBar presence={[entry(ALICE)]} />);

    expect(await screen.findByText('Alice Q — active')).toBeInTheDocument();
    expect(screen.queryByText(/1111…1111/)).not.toBeInTheDocument();
  });

  it('keeps the short-id fallback when the roster entry cannot be resolved', async () => {
    apiGet.mockRejectedValue(new Error('USER_NOT_FOUND'));
    renderWithProviders(<PresenceBar presence={[entry(ALICE)]} />);

    expect(await screen.findByText('1111…1111 — active')).toBeInTheDocument();
  });
});
