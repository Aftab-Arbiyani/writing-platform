import { Visibility } from '@qalam/shared';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { useSettings, useUpdateSettings } from '../hooks/use-settings';
import { AppearancePage } from './appearance-page';

vi.mock('../hooks/use-settings', () => ({
  useSettings: vi.fn(),
  useUpdateSettings: vi.fn(),
}));

const mutate = vi.fn();

describe('AppearancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSettings).mockReturnValue({
      data: {
        theme: 'system',
        defaultPieceVisibility: Visibility.Public,
        notificationPreferences: { newFollower: true },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSettings>);
    vi.mocked(useUpdateSettings).mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateSettings>);
  });

  it('renders theme, default visibility, and a link to notification settings', () => {
    renderWithProviders(<AppearancePage />, { route: '/settings/appearance' });
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getByText('Default visibility for new pieces')).toBeInTheDocument();
    // Notification categories moved to their own page (F8); Appearance links there.
    expect(screen.getByRole('link', { name: /Manage notification settings/ })).toHaveAttribute(
      'href',
      '/settings/notifications',
    );
  });

  it('persists a theme change to the settings API', () => {
    renderWithProviders(<AppearancePage />, { route: '/settings/appearance' });
    fireEvent.click(screen.getByRole('radio', { name: /Dark/ }));
    expect(mutate).toHaveBeenCalledWith({ theme: 'dark' }, expect.anything());
  });
});
