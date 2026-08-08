import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { AiAccountSwitch } from './ai-account-switch';

const get = vi.fn();
const patch = vi.fn();
vi.mock('@/lib/api-client', () => ({
  get: (...args: unknown[]) => get(...args) as unknown,
  patch: (...args: unknown[]) => patch(...args) as unknown,
}));

function settings(aiEnabled: boolean) {
  return {
    theme: 'system',
    defaultPieceVisibility: 'public',
    notificationPreferences: {},
    aiEnabled,
  };
}

/**
 * B5 (docs/45 §4.10) — the account's own AI switch.
 *
 * These assert REACHABILITY and effect, not wire shape: that the control renders, that
 * flipping it actually PATCHes the preference, and — the part that makes it more than a
 * client-side hide — that the AI gate read is invalidated so every AI surface re-reads the
 * server rather than keeping affordances the server would now refuse.
 */
describe('AiAccountSwitch (B5)', () => {
  beforeEach(() => {
    get.mockReset();
    patch.mockReset();
  });

  it('renders on, since AI is on by default', async () => {
    get.mockResolvedValue(settings(true));
    renderWithProviders(<AiAccountSwitch />);

    const toggle = await screen.findByRole('switch', { name: 'Use AI on this account' });
    await waitFor(() => {
      expect(toggle).toBeChecked();
    });
  });

  it('renders off for a writer who already turned AI off', async () => {
    get.mockResolvedValue(settings(false));
    renderWithProviders(<AiAccountSwitch />);

    const toggle = await screen.findByRole('switch', { name: 'Use AI on this account' });
    await waitFor(() => {
      expect(toggle).not.toBeChecked();
    });
  });

  it('turns AI off through the server — a PATCH, not a local hide', async () => {
    get.mockResolvedValue(settings(true));
    patch.mockResolvedValue(settings(false));
    renderWithProviders(<AiAccountSwitch />);

    const toggle = await screen.findByRole('switch', { name: 'Use AI on this account' });
    await waitFor(() => {
      expect(toggle).toBeChecked();
    });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(patch).toHaveBeenCalledWith('/settings', { aiEnabled: false });
    });
  });

  it('turns it back on again — the remedy the error copy promises has to work', async () => {
    get.mockResolvedValue(settings(false));
    patch.mockResolvedValue(settings(true));
    renderWithProviders(<AiAccountSwitch />);

    const toggle = await screen.findByRole('switch', { name: 'Use AI on this account' });
    await waitFor(() => {
      expect(toggle).not.toBeChecked();
    });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(patch).toHaveBeenCalledWith('/settings', { aiEnabled: true });
    });
  });

  it('says how it differs from the training consent, in a writer’s words', async () => {
    get.mockResolvedValue(settings(true));
    renderWithProviders(<AiAccountSwitch />);

    // §4.10 requires the two be legible as different choices to a non-technical writer —
    // "offer me the tools" here, "train on my work" in the privacy consent.
    expect(
      await screen.findByText(/separate from whether your work may be used to improve AI/i),
    ).toBeInTheDocument();
  });

  it('reports a failed save instead of pretending AI is off', async () => {
    get.mockResolvedValue(settings(true));
    patch.mockRejectedValue(new Error('nope'));
    renderWithProviders(<AiAccountSwitch />);

    const toggle = await screen.findByRole('switch', { name: 'Use AI on this account' });
    await waitFor(() => {
      expect(toggle).toBeChecked();
    });
    fireEvent.click(toggle);

    // The server is the source of truth; a silent failure here would leave the writer believing
    // AI was off while every AI request still succeeded.
    expect(await screen.findByRole('alert')).toHaveTextContent(/didn’t save/i);
    await waitFor(() => {
      expect(toggle).toBeChecked();
    });
  });
});
