import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '@/lib/constants';
import { renderWithProviders } from '@/test/render';

import { BUILT_IN_PROMPT_PRESETS } from '../lib/prompt-presets';
import { usePromptLibraryStore } from '../stores/prompt-library.store';
import { PromptLibraryPage } from './prompt-library-page';

const writeText = vi.fn<(text: string) => Promise<void>>();

describe('PromptLibraryPage', () => {
  beforeEach(() => {
    localStorage.clear();
    usePromptLibraryStore.setState({
      customPresets: [],
      favoriteIds: [],
      history: [],
      pendingInstruction: null,
    });
    writeText.mockReset();
    writeText.mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
  });

  it('renders the whole built-in shelf', async () => {
    renderWithProviders(<PromptLibraryPage />);
    const shelf = await screen.findByRole('list', { name: 'Built in' });
    // Seven, matching mobile's `kBuiltInPromptPresets` — a shorter shelf here would be a silent
    // parity gap that no wire test could catch, since there is no wire.
    expect(shelf.querySelectorAll('li')).toHaveLength(BUILT_IN_PROMPT_PRESETS.length);
    expect(BUILT_IN_PROMPT_PRESETS).toHaveLength(7);
  });

  describe('use in assistant', () => {
    it('hands the instruction to the assistant and leaves the editor to run it', async () => {
      renderWithProviders(<PromptLibraryPage />);
      fireEvent.click(await screen.findByRole('button', { name: 'Use Essay in the assistant' }));

      // Stashed for the assistant to consume, and recorded as used — but NOT sent. The writer edits
      // it against their selection and chooses when to run it.
      await waitFor(() =>
        expect(usePromptLibraryStore.getState().pendingInstruction).toBe(
          'Sharpen the argument in this passage and make the reasoning clearer.',
        ),
      );
      expect(usePromptLibraryStore.getState().history).toHaveLength(1);
    });

    it('does not need the clipboard, which can be blocked outright', async () => {
      // The whole point of this route: a denied clipboard must not stand between a writer and a
      // preset. `writeText` is never called.
      renderWithProviders(<PromptLibraryPage />);
      fireEvent.click(await screen.findByRole('button', { name: 'Use Essay in the assistant' }));
      await waitFor(() =>
        expect(usePromptLibraryStore.getState().pendingInstruction).not.toBeNull(),
      );
      expect(writeText).not.toHaveBeenCalled();
    });

    it('is consumed exactly once, so a later visit starts blank', async () => {
      renderWithProviders(<PromptLibraryPage />);
      fireEvent.click(await screen.findByRole('button', { name: 'Use Essay in the assistant' }));
      await waitFor(() =>
        expect(usePromptLibraryStore.getState().pendingInstruction).not.toBeNull(),
      );

      expect(usePromptLibraryStore.getState().takePendingInstruction()).toContain('Sharpen');
      // A second read must be empty — otherwise a prompt chosen for one draft reappears on the next.
      expect(usePromptLibraryStore.getState().takePendingInstruction()).toBeNull();
    });

    it('is never persisted, so it cannot survive into another session', async () => {
      renderWithProviders(<PromptLibraryPage />);
      fireEvent.click(await screen.findByRole('button', { name: 'Use Essay in the assistant' }));
      await waitFor(() =>
        expect(usePromptLibraryStore.getState().pendingInstruction).not.toBeNull(),
      );
      // `partialize` keeps only the durable three; a stored hand-off would prefill Ask AI days later.
      expect(localStorage.getItem(STORAGE_KEYS.promptLibrary)).not.toContain('pendingInstruction');
    });
  });

  it('shows a preset instruction, not just its title', async () => {
    renderWithProviders(<PromptLibraryPage />);
    // The instruction is the thing the writer copies and edits, so it has to be readable before the
    // copy — a library of opaque titles cannot be chosen from.
    expect(
      await screen.findByText('Rewrite this in a precise, formal academic register.'),
    ).toBeInTheDocument();
  });

  it('says the presets are device-local', async () => {
    // There is no server surface for them (docs/48 §3.12), so a writer must not assume they sync.
    renderWithProviders(<PromptLibraryPage />);
    expect(await screen.findByText('Saved on this device only.')).toBeInTheDocument();
  });

  describe('copy', () => {
    it('copies the instruction and records it in history', async () => {
      renderWithProviders(<PromptLibraryPage />);
      fireEvent.click(await screen.findByRole('button', { name: 'Copy Poetry' }));

      await waitFor(() =>
        expect(writeText).toHaveBeenCalledWith(
          'Suggest more evocative imagery for these lines without changing their meaning.',
        ),
      );
      await waitFor(() => expect(usePromptLibraryStore.getState().history).toHaveLength(1));
    });

    it('does not record history when the clipboard is blocked', async () => {
      // A denied clipboard is a real browser state (insecure context, permission refused). Recording
      // a "recently used" prompt the writer never actually got would be fabricated history.
      writeText.mockRejectedValue(new Error('denied'));
      renderWithProviders(<PromptLibraryPage />);
      fireEvent.click(await screen.findByRole('button', { name: 'Copy Poetry' }));

      await waitFor(() => expect(writeText).toHaveBeenCalled());
      expect(usePromptLibraryStore.getState().history).toEqual([]);
    });
  });

  describe('custom presets', () => {
    it('saves one from the form', async () => {
      renderWithProviders(<PromptLibraryPage />);
      fireEvent.change(await screen.findByRole('textbox', { name: 'Prompt title' }), {
        target: { value: 'Scene starter' },
      });
      fireEvent.change(screen.getByRole('textbox', { name: 'Prompt instruction' }), {
        target: { value: 'Continue the scene.' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save prompt' }));

      await waitFor(() => expect(usePromptLibraryStore.getState().customPresets).toHaveLength(1));
      expect(screen.getByRole('list', { name: 'Your prompts' })).toBeInTheDocument();
    });

    it('refuses to save without an instruction', async () => {
      renderWithProviders(<PromptLibraryPage />);
      // A title with no instruction is an empty preset — it would occupy a row and do nothing.
      fireEvent.change(await screen.findByRole('textbox', { name: 'Prompt title' }), {
        target: { value: 'Only a title' },
      });
      expect(screen.getByRole('button', { name: 'Save prompt' })).toBeDisabled();
    });

    it('saves exactly once per click', async () => {
      // The button is a form submit inside a `<form onSubmit>`; wiring `save` to both would store the
      // preset twice per click.
      renderWithProviders(<PromptLibraryPage />);
      fireEvent.change(await screen.findByRole('textbox', { name: 'Prompt instruction' }), {
        target: { value: 'Once only.' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save prompt' }));

      await waitFor(() => expect(usePromptLibraryStore.getState().customPresets).toHaveLength(1));
    });

    it('offers no delete on a built-in preset', async () => {
      renderWithProviders(<PromptLibraryPage />);
      await screen.findByRole('list', { name: 'Built in' });
      // Built-ins ship in code, so "deleting" one could only hide it — and it would return on the
      // next build, which is worse than not offering it.
      expect(screen.queryByRole('button', { name: 'Delete Poetry' })).toBeNull();
    });
  });

  describe('favourites', () => {
    it('exposes the toggle as a pressed-state control and promotes the preset', async () => {
      renderWithProviders(<PromptLibraryPage />);
      const star = await screen.findByRole('button', { name: 'Favourite Novel' });
      expect(star).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(star);

      await waitFor(() =>
        expect(screen.getByRole('list', { name: 'Favourites' })).toBeInTheDocument(),
      );
      expect(usePromptLibraryStore.getState().favoriteIds).toEqual(['preset.novel']);
    });
  });

  describe('history', () => {
    it('lists used prompts and clears them', async () => {
      usePromptLibraryStore.setState({ history: ['An earlier instruction'] });
      renderWithProviders(<PromptLibraryPage />);

      expect(
        await screen.findByRole('list', { name: 'Recently used prompts' }),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

      await waitFor(() => expect(usePromptLibraryStore.getState().history).toEqual([]));
    });
  });
});
