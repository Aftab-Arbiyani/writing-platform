import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { SuggestionComposer } from './suggestion-composer';

/**
 * The regression guard for defect **M-2** (docs/48 §3.2): mobile's suggestion create omitted the
 * REQUIRED `anchor` and sent `blockId`/`rationale` instead, so it could only ever 400. If someone
 * later "simplifies" this composer by dropping the anchor, these fail.
 */
describe('SuggestionComposer', () => {
  it('submits an anchor with the two text passages, and nothing else', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <SuggestionComposer isPending={false} onSubmit={onSubmit} onCancel={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText('Text to replace'), {
      target: { value: 'old words' },
    });
    fireEvent.change(screen.getByLabelText('Proposed wording'), {
      target: { value: 'new words' },
    });
    fireEvent.change(screen.getByLabelText('Starts at character'), { target: { value: '12' } });

    fireEvent.click(screen.getByRole('button', { name: 'Propose edit' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        // `to` is derived from the replaced text's length, so the two can never disagree.
        anchor: { from: 12, to: 12 + 'old words'.length },
        originalText: 'old words',
        suggestedText: 'new words',
      });
    });
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    // The two keys the DTO rejects.
    expect(payload).not.toHaveProperty('blockId');
    expect(payload).not.toHaveProperty('rationale');
  });

  it('cannot be submitted without the replaced text', () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <SuggestionComposer isPending={false} onSubmit={onSubmit} onCancel={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText('Proposed wording'), {
      target: { value: 'new words' },
    });

    expect(screen.getByRole('button', { name: 'Propose edit' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
