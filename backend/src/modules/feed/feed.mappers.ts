import type { TextDirection } from '@qalam/shared';

import type { WriterCardRow } from './discovery.repository';
import type { CardRow } from './feed.repository';
import type { FeedItemDto } from './dto/feed-item.dto';
import type { WriterCardDto } from './dto/writer-card.dto';

/** CardRow (raw join) → the wire card. Dates become ISO strings (JSON/cache-safe). */
export function toFeedItem(row: CardRow): FeedItemDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    featuredQuote: row.featuredQuote,
    coverImageKey: row.coverImageKey,
    language: {
      code: row.langCode,
      direction: row.langDirection as TextDirection,
      nativeName: row.langNativeName,
    },
    genre: row.genreSlug !== null ? { slug: row.genreSlug, name: row.genreName ?? '' } : null,
    author: { username: row.username, penName: row.penName, avatarKey: row.avatarKey },
    stats: {
      likes: Number(row.likesCount),
      claps: Number(row.clapsCount),
      comments: Number(row.commentsCount),
      responses: Number(row.responsesCount),
    },
    visibility: row.visibility,
    wordCount: Number(row.wordCount),
    readingTimeSeconds: Number(row.readingTimeSeconds),
    publishedAt: row.publishedAt !== null ? new Date(row.publishedAt).toISOString() : null,
  };
}

/** WriterCardRow → the wire writer card (counts from denormalized profiles). */
export function toWriterCard(row: WriterCardRow): WriterCardDto {
  return {
    username: row.username,
    penName: row.penName,
    avatarKey: row.avatarKey,
    bio: row.bio,
    followersCount: Number(row.followersCount),
    piecesCount: Number(row.piecesCount),
  };
}
