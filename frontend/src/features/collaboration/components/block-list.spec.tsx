import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { trustApi } from '../api/trust.api';
import type { BlockEntry } from '../types/collaboration.types';
import { BlockList } from './block-list';

vi.mock('../api/trust.api');

const blocks = vi.mocked(trustApi.blocks);
const unblock = vi.mocked(trustApi.unblock);
const unmute = vi.mocked(trustApi.unmute);

/** The two ids that must never be confused: the ROW's id, and the blocked USER's id. */
const ROW_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '99999999-9999-9999-9999-999999999999';

function entry(over: Partial<BlockEntry> = {}): BlockEntry {
  return {
    id: ROW_ID,
    blockerId: '22222222-2222-2222-2222-222222222222',
    blockedId: USER_ID,
    kind: 'block',
    createdAt: new Date('2026-07-01T10:00:00Z').toISOString(),
    ...over,
  };
}

/** Clicks through the AntD confirm dialog the destructive actions raise. */
async function confirmDialog(name: RegExp): Promise<void> {
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(await within(dialog).findByRole('button', { name }));
}

describe('BlockList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unblock.mockResolvedValue(undefined);
    unmute.mockResolvedValue(undefined);
  });

  /**
   * Defect **T-1** (`qalam-mobile/docs/56` §2.3), and the whole reason this spec exists.
   *
   * `BlockDto` carries BOTH ids: `id` is the block relationship, `blockedId` is the person. Mobile
   * read `json['userId'] ?? json['id']` — there is no `userId` on the wire, so it silently used the
   * ROW id. Both are UUIDs, so `DELETE /users/:id/block` passed `ParseUUIDPipe`, reached the service,
   * and 404'd `BLOCK_NOT_FOUND`: unblocking could never work, and nothing in the client said why.
   */
  it('unblocks by the USER id, never the block row id (T-1)', async () => {
    blocks.mockResolvedValue([entry()]);
    renderWithProviders(<BlockList />);

    fireEvent.click(await screen.findByRole('button', { name: 'Unblock' }));
    await confirmDialog(/^Unblock$/);

    await waitFor(() => {
      expect(unblock).toHaveBeenCalledWith(USER_ID);
    });
    expect(unblock).not.toHaveBeenCalledWith(ROW_ID);
  });

  it('unmutes by the user id too, and calls the MUTE route', async () => {
    blocks.mockResolvedValue([entry({ kind: 'mute' })]);
    renderWithProviders(<BlockList />);

    fireEvent.click(await screen.findByRole('button', { name: 'Unmute' }));
    await confirmDialog(/^Unmute$/);

    await waitFor(() => {
      expect(unmute).toHaveBeenCalledWith(USER_ID);
    });
    // A mute is not a block: removing one through the other route would 404.
    expect(unblock).not.toHaveBeenCalled();
  });

  it('distinguishes a block from a mute in the list', async () => {
    blocks.mockResolvedValue([entry(), entry({ id: 'row-2', kind: 'mute' })]);
    renderWithProviders(<BlockList />);

    expect(await screen.findByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('Muted')).toBeInTheDocument();
  });

  it('cancelling the confirm removes nothing', async () => {
    blocks.mockResolvedValue([entry()]);
    renderWithProviders(<BlockList />);

    fireEvent.click(await screen.findByRole('button', { name: 'Unblock' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

    expect(unblock).not.toHaveBeenCalled();
  });

  it('says so when nobody is blocked', async () => {
    blocks.mockResolvedValue([]);
    renderWithProviders(<BlockList />);
    expect(await screen.findByText(/haven’t blocked or muted anyone/i)).toBeInTheDocument();
  });

  it('surfaces a load failure as an alert', async () => {
    blocks.mockRejectedValue(new Error('boom'));
    renderWithProviders(<BlockList />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t load your blocked list/i);
  });
});
