import { POLICY_ACTIONS, PolicyEffect, SnapshotReason } from '@qalam/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { collaborationApi } from '../api/collaboration.api';
import { publishingApi } from '../api/publishing.api';
import type { StorySnapshot, StorySnapshotHistory } from '../types/collaboration.types';
import { SnapshotList } from './snapshot-list';

vi.mock('../api/collaboration.api');
vi.mock('../api/publishing.api');

const capabilities = vi.mocked(collaborationApi.capabilities);
const snapshots = vi.mocked(publishingApi.snapshots);
const revert = vi.mocked(publishingApi.revert);
const createSnapshot = vi.mocked(publishingApi.createSnapshot);

const STORY = 'story-1';

function snapshot(over: Partial<StorySnapshot> = {}): StorySnapshot {
  return {
    id: 'snap-1',
    storyId: STORY,
    version: 3,
    title: 'A Ghazal',
    content: { type: 'doc', content: [] },
    wordCount: 120,
    reason: SnapshotReason.Publish,
    createdById: 'user-1',
    createdAt: new Date('2026-07-02T10:00:00Z').toISOString(),
    ...over,
  };
}

/**
 * A history response as the server now sends it (B7, docs/45 §4.12) — a clamped `items` plus the
 * TRUE total. Defaults to the unclamped case so the pre-B7 tests read unchanged.
 */
function historyOf(
  items: StorySnapshot[],
  over: Partial<StorySnapshotHistory> = {},
): StorySnapshotHistory {
  return {
    items,
    total: items.length,
    visible: items.length,
    hidden: 0,
    limit: 0,
    unlimited: true,
    ...over,
  };
}

function allow(): void {
  capabilities.mockResolvedValue({
    storyId: STORY,
    capabilities: [
      {
        action: POLICY_ACTIONS.StoryEdit,
        effect: PolicyEffect.Allow,
        allowed: true,
        reason: 'OWNERSHIP',
        obligations: [],
      },
    ],
  });
}

describe('SnapshotList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allow();
  });

  /**
   * A version is described by `version` + `reason`, not a label. The create handler takes no body
   * and hard-codes `manual`, so mobile's `label` was discarded and its list showed a name for a
   * field the wire never carried (defects P-7/P-8).
   */
  it('identifies a version by its number and why it was captured', async () => {
    snapshots.mockResolvedValue(historyOf([snapshot()]));
    renderWithProviders(<SnapshotList storyId={STORY} />);

    expect(await screen.findByText(/Version 3/)).toBeInTheDocument();
    expect(screen.getByText(/On publish/)).toBeInTheDocument();
  });

  it('reverting asks first, then sends the SNAPSHOT id', async () => {
    snapshots.mockResolvedValue(historyOf([snapshot()]));
    revert.mockResolvedValue({} as never);
    renderWithProviders(<SnapshotList storyId={STORY} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Revert' }));
    // Revert rewrites the live piece and no button undoes it — the one action here that confirms.
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/Revert to version 3/);
    fireEvent.click(within(dialog).getByRole('button', { name: /^Revert$/ }));

    await waitFor(() => {
      expect(revert).toHaveBeenCalledWith(STORY, 'snap-1');
    });
  });

  it('cancelling the confirm reverts nothing', async () => {
    snapshots.mockResolvedValue(historyOf([snapshot()]));
    renderWithProviders(<SnapshotList storyId={STORY} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Revert' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

    expect(revert).not.toHaveBeenCalled();
  });

  it('captures with no arguments — the reason is the server’s', async () => {
    snapshots.mockResolvedValue(historyOf([]));
    createSnapshot.mockResolvedValue(snapshot());
    renderWithProviders(<SnapshotList storyId={STORY} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Capture version' }));

    await waitFor(() => {
      expect(createSnapshot).toHaveBeenCalledWith(STORY);
    });
  });

  /** Fails closed, like every other affordance in the feature (docs/49 §3). */
  it('hides capture and revert when the capability map denies story.edit', async () => {
    capabilities.mockResolvedValue({ storyId: STORY, capabilities: [] });
    snapshots.mockResolvedValue(historyOf([snapshot()]));
    renderWithProviders(<SnapshotList storyId={STORY} />);

    expect(await screen.findByText(/Version 3/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revert' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Capture version' })).not.toBeInTheDocument();
  });

  it('explains an empty list rather than showing nothing', async () => {
    snapshots.mockResolvedValue(historyOf([]));
    renderWithProviders(<SnapshotList storyId={STORY} />);
    expect(await screen.findByText(/No versions yet/)).toBeInTheDocument();
  });

  // ── B7: version-history depth, by plan (docs/45 §4.12) ──────────────────────────────────────

  describe('when the owner’s plan hides older versions', () => {
    /** Five rows clamped out of thirty-two — the shape a free author's story reaches. */
    function clamped(): StorySnapshotHistory {
      return historyOf(
        [3, 2, 1].map((version) => snapshot({ id: `snap-${String(version)}`, version })),
        { total: 32, visible: 3, hidden: 29, limit: 3, unlimited: false },
      );
    }

    it('says "3 of 32 versions" rather than pretending the other 29 do not exist', async () => {
      snapshots.mockResolvedValue(clamped());
      renderWithProviders(<SnapshotList storyId={STORY} />);

      // Read off the server's total. `items.length` would say "3 versions", which is false.
      expect(await screen.findByText('3 of 32 versions')).toBeInTheDocument();
    });

    it('offers the plan where the hidden versions would be, and says they still exist', async () => {
      snapshots.mockResolvedValue(clamped());
      renderWithProviders(<SnapshotList storyId={STORY} />);

      expect(
        await screen.findByText(/29 older versions are saved but not shown/),
      ).toBeInTheDocument();
      expect(screen.getByText(/Nothing was deleted/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'See plans' })).toBeInTheDocument();
    });

    it('keeps Capture live — an author at their depth still gets new versions', async () => {
      snapshots.mockResolvedValue(clamped());
      createSnapshot.mockResolvedValue(snapshot());
      renderWithProviders(<SnapshotList storyId={STORY} />);

      // The row's whole hazard: B7 clamps the READ. A disabled Capture here would be the client
      // half of the correctness bug the server test guards against.
      const capture = await screen.findByRole('button', { name: 'Capture version' });
      expect(capture).toBeEnabled();

      fireEvent.click(capture);
      await waitFor(() => {
        expect(createSnapshot).toHaveBeenCalledWith(STORY);
      });
    });

    it('still lists and reverts the versions that ARE shown', async () => {
      snapshots.mockResolvedValue(clamped());
      revert.mockResolvedValue({} as never);
      renderWithProviders(<SnapshotList storyId={STORY} />);

      expect(await screen.findByText(/Version 3/)).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Revert' })).toHaveLength(3);
    });

    it('shows no count and no offer when the plan shows everything', async () => {
      snapshots.mockResolvedValue(historyOf([snapshot()], { total: 1, visible: 1, hidden: 0 }));
      renderWithProviders(<SnapshotList storyId={STORY} />);

      expect(await screen.findByText(/Version 3/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'See plans' })).not.toBeInTheDocument();
      expect(screen.queryByText(/of 1 version/)).not.toBeInTheDocument();
    });
  });
});
