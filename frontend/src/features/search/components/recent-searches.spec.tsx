import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/stores/auth.store';

import { useSearchStore } from '../stores/search.store';
import { RecentSearches } from './recent-searches';

describe('RecentSearches (local/anonymous path)', () => {
  beforeEach(() => {
    useAuthStore.getState().setAnonymous();
    useSearchStore.setState({ recent: ['barish', 'shaam'] });
  });
  afterEach(() => {
    useSearchStore.setState({ recent: [] });
  });

  it('renders the device-local recent queries', () => {
    renderWithProviders(<RecentSearches onRun={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'barish' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'shaam' })).toBeInTheDocument();
  });

  it('re-runs a query when its chip is clicked', () => {
    const onRun = vi.fn();
    renderWithProviders(<RecentSearches onRun={onRun} />);
    fireEvent.click(screen.getByRole('button', { name: 'barish' }));
    expect(onRun).toHaveBeenCalledWith('barish');
  });

  it('forgets a single query via its remove button', () => {
    renderWithProviders(<RecentSearches onRun={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Remove.*barish/ }));
    expect(screen.queryByRole('button', { name: 'barish' })).not.toBeInTheDocument();
    expect(useSearchStore.getState().recent).toEqual(['shaam']);
  });

  it('clears the whole history and then renders nothing', () => {
    renderWithProviders(<RecentSearches onRun={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Clear all/ }));
    expect(useSearchStore.getState().recent).toEqual([]);
    expect(screen.queryByText('Recent')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'shaam' })).not.toBeInTheDocument();
  });

  it('renders nothing when there is no history', () => {
    useSearchStore.setState({ recent: [] });
    renderWithProviders(<RecentSearches onRun={vi.fn()} />);
    expect(screen.queryByText('Recent')).not.toBeInTheDocument();
  });
});
