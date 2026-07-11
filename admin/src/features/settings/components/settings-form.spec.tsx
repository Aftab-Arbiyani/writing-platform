import { Settings2 } from 'lucide-react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { useUpdateSettings } from '../hooks/use-settings';
import { useUnsavedChanges } from '../stores/unsaved-changes.store';
import type { Setting } from '../types/settings.types';
import { SettingsForm } from './settings-form';

vi.mock('../hooks/use-settings', () => ({ useUpdateSettings: vi.fn() }));

const mockUpdate = useUpdateSettings as unknown as Mock;

function setting(overrides: Partial<Setting>): Setting {
  return {
    key: 'x.y',
    category: 'authentication',
    value: '',
    dataType: 'string',
    defaultValue: '',
    validationRules: {},
    description: 'desc',
    editable: true,
    environmentScope: 'all',
    updatedBy: null,
    updatedAt: null,
    ...overrides,
  };
}

const authSettings: Setting[] = [
  setting({
    key: 'auth.registration.enabled',
    dataType: 'boolean',
    value: true,
    defaultValue: true,
    description: 'Allow new sign-ups.',
  }),
  setting({
    key: 'auth.session.timeoutMinutes',
    dataType: 'number',
    value: 1440,
    validationRules: { min: 5, max: 43200, integer: true },
  }),
];

const notificationSettings: Setting[] = [
  setting({
    key: 'notification.email.enabled',
    category: 'notifications',
    dataType: 'boolean',
    value: true,
    defaultValue: true,
  }),
  setting({
    key: 'notification.digest.frequency',
    category: 'notifications',
    dataType: 'enum',
    value: 'weekly',
    validationRules: { enum: ['daily', 'weekly', 'off'] },
  }),
];

let mutate: Mock;

beforeEach(() => {
  mutate = vi.fn();
  mockUpdate.mockReturnValue({ mutate, isPending: false });
  useUnsavedChanges.setState({ dirty: false });
});

afterEach(() => vi.clearAllMocks());

describe('SettingsForm — authentication', () => {
  it('renders a labelled control per setting and no save bar when clean', () => {
    renderWithProviders(
      <SettingsForm
        category="authentication"
        settings={authSettings}
        title="Authentication"
        description="Sign-in options."
        icon={Settings2}
      />,
    );
    expect(screen.getByText('Registration enabled')).toBeInTheDocument();
    expect(screen.getByText('Session timeout (minutes)')).toBeInTheDocument();
    expect(screen.queryByText(/unsaved/i)).not.toBeInTheDocument();
  });

  it('toggling a setting shows the save bar and saves the changed key', async () => {
    renderWithProviders(
      <SettingsForm
        category="authentication"
        settings={authSettings}
        title="Authentication"
        description="Sign-in options."
        icon={Settings2}
      />,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'auth.registration.enabled' }));

    expect(await screen.findByText('1 unsaved change')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0]?.[0]).toEqual({
      category: 'authentication',
      payload: { updates: [{ key: 'auth.registration.enabled', value: false }] },
    });
  });

  it('reset discards edits and hides the save bar', async () => {
    renderWithProviders(
      <SettingsForm
        category="authentication"
        settings={authSettings}
        title="Authentication"
        description="Sign-in options."
        icon={Settings2}
      />,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'auth.registration.enabled' }));
    expect(await screen.findByText('1 unsaved change')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    await waitFor(() => expect(screen.queryByText(/unsaved/i)).not.toBeInTheDocument());
    expect(mutate).not.toHaveBeenCalled();
  });
});

describe('SettingsForm — notifications', () => {
  it('renders notification toggles and the digest enum', () => {
    renderWithProviders(
      <SettingsForm
        category="notifications"
        settings={notificationSettings}
        title="Notifications"
        description="Delivery defaults."
        icon={Settings2}
      />,
    );
    expect(screen.getByText('Email notifications')).toBeInTheDocument();
    expect(screen.getByText('Digest frequency')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'notification.email.enabled' })).toBeInTheDocument();
  });
});
