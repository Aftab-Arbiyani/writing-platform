import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { useReaderPreferences } from '../stores/reader-preferences.store';
import type { TipTapNode } from '../types/reading.types';
import { ContentRenderer } from './content-renderer';

function doc(...content: TipTapNode[]): TipTapNode {
  return { type: 'doc', content };
}
const text = (value: string, marks?: { type: string }[]): TipTapNode => ({
  type: 'text',
  text: value,
  marks,
});

describe('ContentRenderer', () => {
  // The preference store is persisted and module-global — reset it so each case starts from
  // the shipped defaults rather than whatever the previous case chose.
  beforeEach(() => {
    useReaderPreferences.getState().reset();
  });

  it('renders paragraphs, headings and marks from the whitelisted schema', () => {
    renderWithProviders(
      <ContentRenderer
        content={doc(
          { type: 'heading', attrs: { level: 2 }, content: [text('A heading')] },
          {
            type: 'paragraph',
            content: [text('plain '), text('bold', [{ type: 'bold' }]), text(' tail')],
          },
        )}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'A heading' })).toBeInTheDocument();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
  });

  it('maps heading levels 2-4 and never emits an h1 (the page title owns that)', () => {
    renderWithProviders(
      <ContentRenderer
        content={doc(
          { type: 'heading', attrs: { level: 3 }, content: [text('Three')] },
          { type: 'heading', attrs: { level: 4 }, content: [text('Four')] },
          // Level 1 is rejected by the server sanitizer; if one ever arrives, it must not
          // become a second <h1> and break the document outline.
          { type: 'heading', attrs: { level: 1 }, content: [text('Rogue')] },
        )}
      />,
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Three' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Four' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Rogue' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('renders lists, blockquotes and ordered-list start offsets', () => {
    renderWithProviders(
      <ContentRenderer
        content={doc(
          { type: 'blockquote', content: [{ type: 'paragraph', content: [text('Quoted')] }] },
          {
            type: 'orderedList',
            attrs: { start: 3 },
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [text('Item')] }] },
            ],
          },
        )}
      />,
    );

    expect(screen.getByText('Quoted')).toBeInTheDocument();
    expect(screen.getByRole('list')).toHaveAttribute('start', '3');
  });

  it('skips unknown node types instead of guessing at them', () => {
    renderWithProviders(
      <ContentRenderer
        content={doc(
          { type: 'paragraph', content: [text('kept')] },
          { type: 'somethingNew', content: [text('dropped')] },
        )}
      />,
    );

    expect(screen.getByText('kept')).toBeInTheDocument();
    expect(screen.queryByText('dropped')).not.toBeInTheDocument();
  });

  it('never renders author content as markup (the API serves JSON, not HTML)', () => {
    const { container } = renderWithProviders(
      <ContentRenderer
        content={doc({ type: 'paragraph', content: [text('<img src=x onerror=1>')] })}
      />,
    );

    // The angle brackets survive as text; no element was created from them.
    expect(screen.getByText('<img src=x onerror=1>')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('flips direction and floors the leading at the Nastaliq value', () => {
    const { container } = renderWithProviders(
      <ContentRenderer
        content={doc({ type: 'paragraph', content: [text('اردو')] })}
        dir="rtl"
        script="Nastaliq"
      />,
    );

    const prose = container.querySelector('.qalam-prose');
    expect(prose).toHaveAttribute('dir', 'rtl');
    // Nastaliq is clamped to 2.1 even at the default 'normal' (1.7) preference — docs/06 §7
    // makes the floor non-negotiable, so a reader's spacing choice cannot go under it.
    expect(prose?.getAttribute('style')).toContain('--q-prose-leading: 2.1');
  });

  it('applies the reader’s own size and spacing to the prose column', () => {
    useReaderPreferences.setState({ textSize: 'lg', lineSpacing: 'compact' });
    const { container } = renderWithProviders(
      <ContentRenderer content={doc({ type: 'paragraph', content: [text('hello')] })} />,
    );

    const style = container.querySelector('.qalam-prose')?.getAttribute('style');
    expect(style).toContain('--q-prose-size: 1.5rem');
    expect(style).toContain('--q-prose-leading: 1.5');
  });

  it('honours paragraph alignment but ignores an unknown alignment value', () => {
    const { container } = renderWithProviders(
      <ContentRenderer
        content={doc(
          { type: 'paragraph', attrs: { textAlign: 'center' }, content: [text('centered')] },
          { type: 'paragraph', attrs: { textAlign: 'sideways' }, content: [text('normal')] },
        )}
      />,
    );

    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs[0]).toHaveStyle({ textAlign: 'center' });
    expect(paragraphs[1]?.getAttribute('style')).toBeNull();
  });
});
