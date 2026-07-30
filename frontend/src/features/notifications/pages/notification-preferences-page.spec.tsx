import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/stores/auth.store';

import { notificationsApi } from '../api/notifications.api';
import { NotificationPreferencesPage } from './notification-preferences-page';

vi.mock('../api/notifications.api', () => ({
  notificationsApi: { getPreferences: vi.fn(), updatePreferences: vi.fn() },
}));

const api = vi.mocked(notificationsApi);

const ALL_ON = {
  follow: true,
  comment: true,
  reply: true,
  reaction: true,
  mention: true,
  response: true,
  system: true,
};

describe('NotificationPreferencesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ status: 'authenticated' });
    api.getPreferences.mockResolvedValue({ ...ALL_ON });
    api.updatePreferences.mockResolvedValue({ ...ALL_ON, mention: false });
  });

  it('renders every category toggle from the backend preferences', async () => {
    renderWithProviders(<NotificationPreferencesPage />, { route: '/settings/notifications' });
    expect(await screen.findByRole('switch', { name: 'Mentions' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Comments' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Claps & likes' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Announcements' })).toBeInTheDocument();
  });

  it('optimistically PATCHes a category toggle', async () => {
    renderWithProviders(<NotificationPreferencesPage />, { route: '/settings/notifications' });
    fireEvent.click(await screen.findByRole('switch', { name: 'Mentions' }));
    await waitFor(() => {
      expect(api.updatePreferences).toHaveBeenCalledWith({ mention: false });
    });
  });

  it('exposes the local new-notification toast preference', async () => {
    renderWithProviders(<NotificationPreferencesPage />, { route: '/settings/notifications' });
    const toastSwitch = await screen.findByRole('switch', { name: 'New-notification toasts' });
    expect(toastSwitch).toBeInTheDocument();
    // Does not hit the notifications API — it's a device-local Zustand preference.
    fireEvent.click(toastSwitch);
    expect(api.updatePreferences).not.toHaveBeenCalled();
  });
});
