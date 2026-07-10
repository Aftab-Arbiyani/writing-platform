import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HighlightText } from './highlight-text';

describe('HighlightText', () => {
  it('wraps the matched substring in a <mark>, preserving original casing', () => {
    render(<HighlightText text="Ghazal evening" query="ghaz" />);
    const mark = screen.getByText('Ghaz');
    expect(mark.tagName).toBe('MARK');
    // The surrounding text is still present.
    expect(screen.getByText(/al evening/)).toBeInTheDocument();
  });

  it('matches case-insensitively', () => {
    render(<HighlightText text="Barish" query="BAR" />);
    expect(screen.getByText('Bar').tagName).toBe('MARK');
  });

  it('renders plain text with no <mark> when there is no match', () => {
    const { container } = render(<HighlightText text="nazm" query="xyz" />);
    expect(container.querySelector('mark')).toBeNull();
    expect(screen.getByText('nazm')).toBeInTheDocument();
  });

  it('renders plain text when the query is empty', () => {
    const { container } = render(<HighlightText text="ishq" query="  " />);
    expect(container.querySelector('mark')).toBeNull();
  });
});
