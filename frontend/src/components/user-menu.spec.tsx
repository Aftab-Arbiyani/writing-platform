import { fireEvent, screen, waitFor } from '@testing-library/react';
import type * as ReactRouter from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { useMe } from '@/hooks/use-me';
import { ROUTES } from '@/lib/routes';

import { UserMenu } from './user-menu';

const navigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router');
  return { ...actual, useNavigate: () => navigate };
});
vi.mock('@/hooks/use-me', () => ({ useMe: vi.fn() }));
vi.mock('@/features/auth/hooks/use-logout', () => ({
  useLogout: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/features/analytics', () => ({ prefetchDashboard: vi.fn() }));

/**
 * The account menu is web's home for account-scoped surfaces, so it is where W7c's reader
 * analytics becomes REACHABLE. These assert reachability, not wiring: the repeated defect class in
 * this codebase (R-1, M5-1, W5-3, W8-1) is a surface that was built and never reached.
 */
describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMe).mockReturnValue({
      data: { penName: 'Aftab', username: 'aftab', avatarKey: null },
    } as unknown as ReturnType<typeof useMe>);
  });

  function openMenu(): void {
    renderWithProviders(<UserMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
  }

  it('reaches the reader analytics surface', async () => {
    openMenu();
    fireEvent.click(await screen.findByText('Your reading'));
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(ROUTES.reading);
    });
    expect(ROUTES.reading).toBe('/me/reading');
  });

  it('reaches the writer analytics surface, under a label naming its audience', async () => {
    openMenu();
    // Not "Your stats" — that label sent readers to a dashboard about pieces they wrote (W7c).
    fireEvent.click(await screen.findByText('Your writing’s stats'));
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(ROUTES.stats);
    });
  });

  it('offers the two analytics surfaces as distinguishable entries', async () => {
    openMenu();
    const reading = await screen.findByText('Your reading');
    const writing = await screen.findByText('Your writing’s stats');

    // Two separate entries, two different destinations — neither is the other's alias.
    expect(reading).not.toBe(writing);
    expect(ROUTES.reading).not.toBe(ROUTES.stats);
    // And no bare "Your stats" survives, which is what made them confusable.
    expect(screen.queryByText('Your stats')).not.toBeInTheDocument();
  });
});
