import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/stores/auth.store';

import { searchApi } from '../api/search.api';
import { useSearchStore } from '../stores/search.store';
import { CommandPalette } from './command-palette';
import { CommandTrigger } from './command-trigger';

vi.mock('../api/search.api', () => ({
  searchApi: { autocomplete: vi.fn(), trending: vi.fn(), recent: vi.fn() },
}));

const autocomplete = vi.mocked(searchApi.autocomplete);
const trending = vi.mocked(searchApi.trending);

function LocationDisplay(): ReactElement {
  const location = useLocation();
  return <span data-testid="loc">{`${location.pathname}${location.search}`}</span>;
}

const openPalette = (): void => {
  act(() => {
    useSearchStore.getState().openCommand();
  });
};

describe('CommandPalette', () => {
  beforeEach(() => {
    useAuthStore.getState().setAnonymous();
    useSearchStore.setState({ recent: [], commandOpen: false });
    autocomplete.mockReset();
    trending.mockReset();
    autocomplete.mockResolvedValue({ writers: [], tags: [], genres: [], pieces: [] });
    trending.mockResolvedValue({ keywords: [], tags: [], genres: [], writers: [] });
  });

  it('opens on ⌘K / Ctrl+K and lists jump-to commands', async () => {
    renderWithProviders(<CommandPalette />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    expect(await screen.findByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Discover' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Go to Home' })).toBeInTheDocument();
  });

  it('opens from the top-bar trigger button', async () => {
    renderWithProviders(
      <>
        <CommandTrigger />
        <CommandPalette />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Open search/ }));
    expect(await screen.findByRole('option', { name: 'Discover' })).toBeInTheDocument();
  });

  it('shows a "search everything" action and instant suggestions while typing', async () => {
    autocomplete.mockResolvedValue({
      writers: [{ username: 'meera_k', penName: 'Meera', avatarKey: null }],
      tags: [],
      genres: [],
      pieces: [],
    });
    renderWithProviders(<CommandPalette />);
    openPalette();

    const input = await screen.findByRole('combobox');
    fireEvent.change(input, { target: { value: 'meera' } });

    expect(await screen.findByText('@meera_k')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Search everything for/ })).toBeInTheDocument();
  });

  it('submits the query on Enter and navigates to full results without a page reload', async () => {
    renderWithProviders(
      <>
        <CommandPalette />
        <LocationDisplay />
      </>,
    );
    openPalette();

    const input = await screen.findByRole('combobox');
    fireEvent.change(input, { target: { value: 'barish' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByTestId('loc')).toHaveTextContent('/search?q=barish');
    });
    expect(useSearchStore.getState().recent).toContain('barish');
  });

  it('jumps straight to a writer profile when its suggestion is chosen', async () => {
    autocomplete.mockResolvedValue({
      writers: [{ username: 'meera_k', penName: 'Meera', avatarKey: null }],
      tags: [],
      genres: [],
      pieces: [],
    });
    renderWithProviders(
      <>
        <CommandPalette />
        <LocationDisplay />
      </>,
    );
    openPalette();

    const input = await screen.findByRole('combobox');
    fireEvent.change(input, { target: { value: 'meera' } });

    const option = await screen.findByRole('option', { name: /@meera_k/ });
    fireEvent.click(option);

    await waitFor(() => {
      expect(screen.getByTestId('loc')).toHaveTextContent('/@meera_k');
    });
  });

  it('runs a jump-to command (Discover) via keyboard: ArrowDown then Enter', async () => {
    renderWithProviders(
      <>
        <CommandPalette />
        <LocationDisplay />
      </>,
    );
    openPalette();

    const input = await screen.findByRole('combobox');
    // With an empty query the first option is the first command ("Go to Home").
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByTestId('loc')).toHaveTextContent('/feed');
    });
  });

  it('closes on Escape', async () => {
    renderWithProviders(<CommandPalette />);
    openPalette();

    const input = await screen.findByRole('combobox');
    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });
    expect(useSearchStore.getState().commandOpen).toBe(false);
  });
});
