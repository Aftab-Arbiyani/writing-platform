import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { useMaintenance, useUpdateMaintenance } from '../hooks/use-maintenance';
import type { Maintenance } from '../types/settings.types';
import { MaintenanceSection } from './maintenance-section';

vi.mock('../hooks/use-maintenance', () => ({
  useMaintenance: vi.fn(),
  useUpdateMaintenance: vi.fn(),
}));

function maintenance(overrides: Partial<Maintenance> = {}): Maintenance {
  return {
    enabled: false,
    message: 'Back soon.',
    estimatedCompletion: null,
    allowedRoles: ['super_admin', 'admin'],
    ...overrides,
  };
}

let mutate: Mock;

beforeEach(() => {
  mutate = vi.fn();
  (useMaintenance as Mock).mockReturnValue({
    data: maintenance(),
    isLoading: false,
    isError: false,
  });
  (useUpdateMaintenance as Mock).mockReturnValue({ mutate, isPending: false });
});

afterEach(() => vi.clearAllMocks());

describe('MaintenanceSection', () => {
  it('renders the current maintenance settings', () => {
    renderWithProviders(<MaintenanceSection />);
    expect(screen.getByRole('heading', { name: 'Maintenance mode' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Back soon.')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Maintenance mode' })).toBeInTheDocument();
  });

  it('confirms before enabling maintenance, then saves', async () => {
    renderWithProviders(<MaintenanceSection />);
    // Turn it on (was off).
    fireEvent.click(screen.getByRole('switch', { name: 'Maintenance mode' }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    // A confirmation is required before enabling.
    expect(await screen.findByText('Enable maintenance mode?')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /enable maintenance/i }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({ enabled: true, message: 'Back soon.' });
  });

  it('saves a message edit directly when maintenance stays disabled', async () => {
    renderWithProviders(<MaintenanceSection />);
    fireEvent.change(screen.getByDisplayValue('Back soon.'), {
      target: { value: 'Scheduled upgrade.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({
      enabled: false,
      message: 'Scheduled upgrade.',
    });
  });
});
