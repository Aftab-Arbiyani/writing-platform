import { POLICY_ACTIONS, PolicyEffect, SnapshotReason } from '@qalam/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { collaborationApi } from '../api/collaboration.api';
import { publishingApi } from '../api/publishing.api';
import type { StorySnapshot } from '../types/collaboration.types';
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
    snapshots.mockResolvedValue([snapshot()]);
    renderWithProviders(<SnapshotList storyId={STORY} />);

    expect(await screen.findByText(/Version 3/)).toBeInTheDocument();
    expect(screen.getByText(/On publish/)).toBeInTheDocument();
  });

  it('reverting asks first, then sends the SNAPSHOT id', async () => {
    snapshots.mockResolvedValue([snapshot()]);
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
    snapshots.mockResolvedValue([snapshot()]);
    renderWithProviders(<SnapshotList storyId={STORY} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Revert' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

    expect(revert).not.toHaveBeenCalled();
  });

  it('captures with no arguments — the reason is the server’s', async () => {
    snapshots.mockResolvedValue([]);
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
    snapshots.mockResolvedValue([snapshot()]);
    renderWithProviders(<SnapshotList storyId={STORY} />);

    expect(await screen.findByText(/Version 3/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revert' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Capture version' })).not.toBeInTheDocument();
  });

  it('explains an empty list rather than showing nothing', async () => {
    snapshots.mockResolvedValue([]);
    renderWithProviders(<SnapshotList storyId={STORY} />);
    expect(await screen.findByText(/No versions yet/)).toBeInTheDocument();
  });
});
