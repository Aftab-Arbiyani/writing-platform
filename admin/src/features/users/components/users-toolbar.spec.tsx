import { Role } from '@qalam/shared';
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

import { UsersToolbar } from './users-toolbar';

function setup(overrides: Partial<Parameters<typeof UsersToolbar>[0]> = {}) {
  const props = {
    search: '',
    onSearchChange: vi.fn(),
    filtersOpen: false,
    onToggleFilters: vi.fn(),
    onRefresh: vi.fn(),
    isFetching: false,
    onExport: vi.fn(),
    onPrint: vi.fn(),
    exporting: false,
    ...overrides,
  };
  renderWithProviders(<UsersToolbar {...props} />);
  return props;
}

describe('UsersToolbar', () => {
  beforeEach(() => useAuthStore.setState({ status: 'authenticated', role: Role.SuperAdmin }));
  afterEach(() => {
    useAuthStore.getState().clear();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('debounces search before committing', () => {
    vi.useFakeTimers();
    const { onSearchChange } = setup();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'meera' } });
    expect(onSearchChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(350));
    expect(onSearchChange).toHaveBeenCalledWith('meera');
  });

  it('toggles the filters panel', () => {
    const { onToggleFilters } = setup();
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));
    expect(onToggleFilters).toHaveBeenCalled();
  });

  it('refreshes on demand', () => {
    const { onRefresh } = setup();
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalled();
  });
});
