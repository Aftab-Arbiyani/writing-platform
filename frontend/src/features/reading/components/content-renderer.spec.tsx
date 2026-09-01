import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { useReaderPreferences } from '../stores/reader-preferences.store';
import type { TipTapNode } from '../types/reading.types';
import { buildBlockAnchors } from '../lib/content-anchors';
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

describe('ContentRenderer — passage selection (C-15)', () => {
  beforeEach(() => {
    useReaderPreferences.getState().reset();
  });

  const body = doc(
    { type: 'heading', attrs: { level: 2 }, content: [text('Chapter one')] },
    { type: 'paragraph', content: [text('first')] },
    { type: 'paragraph', content: [text('second')] },
  );

  it('renders no controls at all when selection is not offered', () => {
    renderWithProviders(<ContentRenderer content={body} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText('first')).toBeInTheDocument();
  });

  it('needs BOTH halves — a map with no handler renders nothing interactive', () => {
    // A control that cannot report anywhere is worse than no control: it looks operable.
    renderWithProviders(<ContentRenderer content={body} blockAnchors={buildBlockAnchors(body)} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('makes every anchored block a control and reports the SERVER-space anchor', () => {
    const onBlockSelect = vi.fn();
    renderWithProviders(
      <ContentRenderer
        content={body}
        blockAnchors={buildBlockAnchors(body)}
        onBlockSelect={onBlockSelect}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(3);
    fireEvent.click(
      screen.getByRole('button', { name: /Suggest an edit to this passage: second/ }),
    );

    // anchorText space, no separators between blocks: 'Chapter one' + 'first' = 16.
    expect(onBlockSelect).toHaveBeenCalledWith({ from: 16, to: 22, text: 'second' });
  });

  it('uses a real <button>, which is what makes it keyboard-operable', () => {
    // The guarantee under test is the ELEMENT, not a synthesized keypress: jsdom does not turn
    // Enter into a click on a button, so asserting the tag is the honest check. A click handler on
    // the <p> would pass a click test and fail every keyboard and screen-reader user.
    renderWithProviders(
      <ContentRenderer
        content={body}
        blockAnchors={buildBlockAnchors(body)}
        onBlockSelect={vi.fn()}
      />,
    );
    for (const control of screen.getAllByRole('button')) {
      expect(control.tagName).toBe('BUTTON');
      expect(control).toHaveAttribute('type', 'button');
    }
  });

  it('leaves an EMPTY block unselectable', () => {
    const withBlank = doc(
      { type: 'paragraph', content: [] },
      { type: 'paragraph', content: [text('kept')] },
    );
    renderWithProviders(
      <ContentRenderer
        content={withBlank}
        blockAnchors={buildBlockAnchors(withBlank)}
        onBlockSelect={vi.fn()}
      />,
    );
    // Offering to rewrite a blank paragraph is a broken-looking affordance for no benefit.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('degrades to NO controls when the anchors came from a different parse', () => {
    // The map is keyed by node identity. A separately-parsed copy matches nothing — which must
    // degrade to "not selectable", never to a control carrying another document's offsets.
    const copy = structuredClone(body);
    renderWithProviders(
      <ContentRenderer
        content={body}
        blockAnchors={buildBlockAnchors(copy)}
        onBlockSelect={vi.fn()}
      />,
    );
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
