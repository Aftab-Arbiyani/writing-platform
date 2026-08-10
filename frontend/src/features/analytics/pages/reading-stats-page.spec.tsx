import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/stores/auth.store';

import { analyticsApi } from '../api/analytics.api';
import type { BoundedCount, ReaderAnalytics } from '../types/analytics.types';
import { ReadingStatsPage } from './reading-stats-page';

vi.mock('../api/analytics.api', () => ({
  analyticsApi: { reader: vi.fn(), bookmarksCount: vi.fn() },
}));
/**
 * Stub the echarts ENGINE, not the `chart-core` seam. Unlike the writer dashboard's charts (always
 * empty in its spec, so they never initialise), this page renders POPULATED bar charts — real
 * echarts then boots inside jsdom, where there is no canvas context, and throws on `setOption`
 * and again on `dispose` during cleanup. `chart-core` is reached through a *dynamic* relative
 * import inside `Chart`, so mocking it by path does not intercept; mocking `echarts/core`, which
 * `chart-core` imports statically, does.
 */
vi.mock('echarts/core', () => ({
  init: () => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }),
  use: vi.fn(),
}));

const api = vi.mocked(analyticsApi);

/** A reader with real history — all seven fields non-zero, both ranked lists populated. */
const READER: ReaderAnalytics = {
  piecesRead: 50,
  readingTimeSeconds: 100_000,
  completedReads: 40,
  currentStreak: 5,
  longestStreak: 12,
  favoriteGenres: [
    { key: 'ghazal', label: 'Ghazal', count: 20 },
    { key: 'nazm', label: 'Nazm', count: 8 },
  ],
  favoriteLanguages: [{ key: 'ur', label: 'اردو', count: 30 }],
};

/** A brand-new reader — every figure a TRUE zero, both ranked lists genuinely empty. */
const NEW_READER: ReaderAnalytics = {
  piecesRead: 0,
  readingTimeSeconds: 0,
  completedReads: 0,
  currentStreak: 0,
  longestStreak: 0,
  favoriteGenres: [],
  favoriteLanguages: [],
};

const BOOKMARKS: BoundedCount = { count: 7, hasMore: false };

describe('ReadingStatsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ status: 'authenticated' });
    api.reader.mockResolvedValue(READER);
    api.bookmarksCount.mockResolvedValue(BOOKMARKS);
  });

  it('renders real figures for all seven aggregate fields', async () => {
    renderWithProviders(<ReadingStatsPage />, { route: '/me/reading' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Your reading' })).toBeVisible();

    // 1–3: counts and reading time. Await the first tile — the rest land in the same render.
    expect(await screen.findByText('Pieces read')).toBeVisible();
    expect(screen.getByText('50')).toBeVisible();
    expect(screen.getByText('Reading time')).toBeVisible();
    expect(screen.getByText('27.8h')).toBeVisible(); // 100_000s → formatDurationLong
    expect(screen.getByText('Completed reads')).toBeVisible();
    expect(screen.getByText('40')).toBeVisible();

    // 4–5: both streaks, distinctly labelled (they are different numbers and must not be merged).
    expect(screen.getByText('Current streak')).toBeVisible();
    expect(screen.getByText('5d')).toBeVisible();
    expect(screen.getByText('Longest streak')).toBeVisible();
    expect(screen.getByText('12d')).toBeVisible();

    // 6–7: both ranked lists are rendered, as headings + the chart's a11y table.
    expect(screen.getByText('Favourite genres')).toBeVisible();
    expect(screen.getByText('Favourite languages')).toBeVisible();
  });

  it('renders ranked lists by `label`, not by `key`', async () => {
    renderWithProviders(<ReadingStatsPage />, { route: '/me/reading' });
    await screen.findByRole('heading', { level: 1, name: 'Your reading' });

    // The human label is what a reader sees...
    expect(await screen.findByText('Ghazal')).toBeInTheDocument();
    expect(screen.getByText('Nazm')).toBeInTheDocument();
    expect(screen.getByText('اردو')).toBeInTheDocument();
    // ...and the stable key is never shown as if it were one.
    expect(screen.queryByText('ghazal')).not.toBeInTheDocument();
    expect(screen.queryByText('nazm')).not.toBeInTheDocument();
    expect(screen.queryByText('ur')).not.toBeInTheDocument();
  });

  it('shows a brand-new reader TRUE zeroes and empty lists rather than hiding the page', async () => {
    api.reader.mockResolvedValue(NEW_READER);
    api.bookmarksCount.mockResolvedValue({ count: 0, hasMore: false });
    renderWithProviders(<ReadingStatsPage />, { route: '/me/reading' });

    // The page renders — it is NOT swapped for an empty state. These zeroes are true.
    expect(await screen.findByRole('heading', { level: 1, name: 'Your reading' })).toBeVisible();
    expect(await screen.findByText('Pieces read')).toBeVisible();
    expect(screen.getByText('Current streak')).toBeVisible();
    // Both streaks are a true `0d` for someone who has never read — two tiles, same value.
    expect(screen.getAllByText('0d')).toHaveLength(2);
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);

    // Empty ranked lists say so; they do not vanish and they do not invent a bar.
    expect(screen.getByText('Favourite genres')).toBeVisible();
    expect(screen.getByText('Favourite languages')).toBeVisible();
    expect(screen.queryByText("Couldn't load your analytics.")).not.toBeInTheDocument();
  });

  it('shows an error state on failure — never a fabricated zero', async () => {
    api.reader.mockRejectedValue(new Error('boom'));
    renderWithProviders(<ReadingStatsPage />, { route: '/me/reading' });

    expect(await screen.findByText("Couldn't load your analytics.")).toBeVisible();
    // The tiles must be absent entirely: a `0` here would be indistinguishable from a real zero,
    // and web has no local reading history to degrade to the way mobile does.
    expect(screen.queryByText('Pieces read')).not.toBeInTheDocument();
    expect(screen.queryByText('Current streak')).not.toBeInTheDocument();
  });

  it('is not confusable with the writer dashboard, and links to it', async () => {
    renderWithProviders(<ReadingStatsPage />, { route: '/me/reading' });
    await screen.findByRole('heading', { level: 1, name: 'Your reading' });
    // Await the loaded state first — negative assertions against a skeleton prove nothing.
    await screen.findByText('Pieces read');

    // No writer metric appears on a reader surface.
    expect(screen.queryByText('Total views')).not.toBeInTheDocument();
    expect(screen.queryByText('Followers gained')).not.toBeInTheDocument();
    expect(screen.queryByText('Top performer')).not.toBeInTheDocument();
    // And the writer surface is reachable from here, named for ITS audience.
    expect(screen.getByRole('button', { name: /Your writing’s stats/ })).toBeVisible();
  });

  describe('the bounded bookmarks count', () => {
    it('renders an exact count when the first page is the whole set', async () => {
      renderWithProviders(<ReadingStatsPage />, { route: '/me/reading' });
      await screen.findByRole('heading', { level: 1, name: 'Your reading' });
      expect(await screen.findByText('Bookmarks')).toBeVisible();
      expect(screen.getByText('7')).toBeVisible();
    });

    it('renders `50+` when more exist, never a bare page-size total', async () => {
      // NEW_READER so the only 50 in the DOM can be the bookmarks tile (READER.piecesRead is 50).
      api.reader.mockResolvedValue(NEW_READER);
      api.bookmarksCount.mockResolvedValue({ count: 50, hasMore: true });
      renderWithProviders(<ReadingStatsPage />, { route: '/me/reading' });
      await screen.findByRole('heading', { level: 1, name: 'Your reading' });

      expect(await screen.findByText('50+')).toBeVisible();
      // A bare `50` would read as a total when it is really "the first page was full".
      expect(screen.queryByText('50')).not.toBeInTheDocument();
    });

    it('omits the tile when its own read fails, and keeps the seven real figures', async () => {
      api.bookmarksCount.mockRejectedValue(new Error('nope'));
      renderWithProviders(<ReadingStatsPage />, { route: '/me/reading' });
      await screen.findByRole('heading', { level: 1, name: 'Your reading' });

      // The aggregate is a separate endpoint and still rendered.
      expect(await screen.findByText('Pieces read')).toBeVisible();
      expect(screen.getByText('50')).toBeVisible();
      // Absent, not zero — a `0` would claim the reader has no bookmarks.
      expect(screen.queryByText('Bookmarks')).not.toBeInTheDocument();
    });
  });

  it('does not read either endpoint while the session is unauthenticated', async () => {
    useAuthStore.setState({ status: 'anonymous' });
    renderWithProviders(<ReadingStatsPage />, { route: '/me/reading' });
    await screen.findByRole('heading', { level: 1, name: 'Your reading' });

    // Both queries are auth-gated; the route also sits behind RequireAuth (asserted in E2E).
    expect(api.reader).not.toHaveBeenCalled();
    expect(api.bookmarksCount).not.toHaveBeenCalled();
  });
});
