import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { searchApi } from '../api/search.api';
import type { TrendingSearches as TrendingData } from '../types/search.types';
import { TrendingSearches } from './trending-searches';

vi.mock('../api/search.api', () => ({
  searchApi: { trending: vi.fn() },
}));

const trending = vi.mocked(searchApi.trending);

const DATA: TrendingData = {
  keywords: [{ keyword: 'barish', searchCount: 42 }],
  tags: [{ slug: 'ishq', name: 'ishq', pieceCount: 12 }],
  genres: [{ slug: 'ghazal', name: 'Ghazal', pieceCount: 8 }],
  writers: [{ username: 'meera_k', penName: 'Meera K', avatarKey: null, followersCount: 1200 }],
};

describe('TrendingSearches', () => {
  beforeEach(() => {
    trending.mockReset();
  });

  it('renders trending keywords, genres, tags, and writers from the API', async () => {
    trending.mockResolvedValue(DATA);
    renderWithProviders(<TrendingSearches onRun={vi.fn()} />);

    expect(await screen.findByRole('button', { name: /barish/ })).toBeInTheDocument();
    expect(screen.getByText('Ghazal')).toBeInTheDocument();
    expect(screen.getByText('#ishq')).toBeInTheDocument();
    expect(screen.getByText('Meera K')).toBeInTheDocument();
  });

  it('runs a query when a trending keyword is clicked', async () => {
    trending.mockResolvedValue(DATA);
    const onRun = vi.fn();
    renderWithProviders(<TrendingSearches onRun={onRun} />);

    fireEvent.click(await screen.findByRole('button', { name: /barish/ }));
    expect(onRun).toHaveBeenCalledWith('barish');
  });

  it('shows a calm empty line when nothing is trending', async () => {
    trending.mockResolvedValue({ keywords: [], tags: [], genres: [], writers: [] });
    renderWithProviders(<TrendingSearches onRun={vi.fn()} />);
    expect(await screen.findByText(/Nothing trending right now/)).toBeInTheDocument();
  });
});
