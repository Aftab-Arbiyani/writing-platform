import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import type { FeedItem } from '../types/feed.types';
import { PieceCard } from './piece-card';

function makeItem(over: Partial<FeedItem> = {}): FeedItem {
  return {
    id: 'p1',
    slug: 'a-door-never-opened',
    title: 'A door never opened',
    subtitle: 'On the rooms we leave unentered.',
    featuredQuote: null,
    coverImageKey: null,
    language: { code: 'ur', direction: 'rtl', nativeName: 'اردو' },
    genre: { slug: 'ghazal', name: 'Ghazal' },
    author: { username: 'meera_k', penName: 'Meera K', avatarKey: null },
    stats: { likes: 5, claps: 1200, comments: 3, responses: 0 },
    visibility: 'public',
    wordCount: 500,
    readingTimeSeconds: 360,
    publishedAt: '2026-07-01T00:00:00.000Z',
    ...over,
  };
}

describe('PieceCard', () => {
  it('renders the title as a link to the reading view, author, badges, and read-only counts', () => {
    renderWithProviders(<PieceCard piece={makeItem()} />);

    const link = screen.getByRole('link', { name: 'A door never opened' });
    expect(link).toHaveAttribute('href', '/p/a-door-never-opened');

    expect(screen.getByText('Meera K')).toBeInTheDocument();
    expect(screen.getByText('@meera_k')).toBeInTheDocument();
    expect(screen.getByText('Ghazal')).toBeInTheDocument();
    expect(screen.getByText('اردو')).toBeInTheDocument();
    expect(screen.getByText('6 min')).toBeInTheDocument();
    // Compact counts (Latin digits): claps 1.2K, comments 3.
    expect(screen.getByLabelText('1200 claps')).toBeInTheDocument();
    expect(screen.getByLabelText('3 comments')).toBeInTheDocument();
  });

  it('falls back to the id when the slug is null', () => {
    renderWithProviders(<PieceCard piece={makeItem({ slug: null })} />);
    expect(screen.getByRole('link', { name: 'A door never opened' })).toHaveAttribute(
      'href',
      '/p/p1',
    );
  });

  it('shows a visibility indicator only for non-public pieces', () => {
    const { rerender } = renderWithProviders(
      <PieceCard piece={makeItem({ visibility: 'public' })} />,
    );
    expect(screen.queryByText('Unlisted')).not.toBeInTheDocument();
    expect(screen.queryByText('Private')).not.toBeInTheDocument();

    rerender(<PieceCard piece={makeItem({ visibility: 'private' })} />);
    expect(screen.getByText('Private')).toBeInTheDocument();
  });
});
