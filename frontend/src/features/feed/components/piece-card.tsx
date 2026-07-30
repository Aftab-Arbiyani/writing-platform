import { QAvatar, QCard, QTag } from '@qalam/ui';
import { Clock, Hand, Link2, Lock, MessageCircle } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import { Link } from 'react-router';

import { formatCount, formatReadingTime, formatRelativeTime } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import { piecePath } from '@/lib/routes';

import type { FeedItem } from '../types/feed.types';

/** A read-only stat (claps / comments) — never an action button in F3 (engagement is a later epic). */
function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Hand;
  value: number;
  label: string;
}): ReactElement {
  return (
    <span
      className="inline-flex items-center gap-1 text-ink-muted"
      aria-label={`${String(value)} ${label}`}
    >
      <Icon size={15} strokeWidth={1.75} aria-hidden />
      <span className="tabular-nums">{formatCount(value)}</span>
    </span>
  );
}

/** Visibility indicator — shown only when a piece isn't fully public (docs/06 §3.1 card). */
function VisibilityIndicator({
  visibility,
}: {
  visibility: FeedItem['visibility'];
}): ReactElement | null {
  if (visibility === 'public') return null;
  const isPrivate = visibility === 'private';
  const Icon = isPrivate ? Lock : Link2;
  const label = isPrivate ? 'Private' : 'Unlisted';
  return (
    <span className="inline-flex items-center gap-1 text-ink-muted">
      <Icon size={14} strokeWidth={1.75} aria-hidden />
      {label}
    </span>
  );
}

/**
 * The one `PieceCard` (docs/06 §3.1, §10.3 rule 1) — reused by every feed. The whole card is a
 * single link to the reading view via a stretched title link (one focus stop; the reading view
 * arrives in a later epic). Counts are read-only; there are no clap/save/comment actions here
 * (out of F3 scope). The card's TEXT flips to the piece's script (`dir`/`lang`); the card grid
 * never flips (docs/06 §6.6). `memo` because feed lists grow long.
 */
export const PieceCard = memo(function PieceCard({ piece }: { piece: FeedItem }): ReactElement {
  const { author, language, genre, stats } = piece;
  const displayName = author.penName ?? `@${author.username}`;
  const href = piecePath(piece.slug ?? piece.id);
  const cover = mediaUrl(piece.coverImageKey);

  return (
    <QCard as="article" interactive padding="lg" className="relative flex flex-col gap-3">
      <header className="flex items-center gap-2 text-sm">
        <QAvatar size={32} src={mediaUrl(author.avatarKey)} name={displayName} />
        <span className="flex flex-wrap items-center gap-x-1.5 text-ink-secondary">
          <span className="font-medium text-ink">{displayName}</span>
          <span aria-hidden>·</span>
          <span>@{author.username}</span>
          {piece.publishedAt ? (
            <>
              <span aria-hidden>·</span>
              <time dateTime={piece.publishedAt}>{formatRelativeTime(piece.publishedAt)}</time>
            </>
          ) : null}
        </span>
      </header>

      {cover ? (
        <div className="overflow-hidden rounded-md bg-raised">
          <img
            src={cover}
            alt=""
            width={1200}
            height={630}
            loading="lazy"
            className="aspect-[1200/630] w-full object-cover dark:brightness-[0.92]"
          />
        </div>
      ) : null}

      <h3 className="font-serif text-xl font-semibold leading-snug text-ink">
        {/* Stretched link makes the whole card clickable while staying a single focus stop. */}
        <Link
          to={href}
          dir={language.direction}
          lang={language.code}
          className="rounded-sm after:absolute after:inset-0 after:content-['']"
        >
          {piece.title}
        </Link>
      </h3>

      {piece.subtitle ? (
        <p dir="auto" className="line-clamp-2 text-sm text-ink-secondary">
          {piece.subtitle}
        </p>
      ) : null}

      <footer className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-muted">
        {genre ? (
          <QTag color="neutral" size="sm">
            {genre.name}
          </QTag>
        ) : null}
        <QTag color="neutral" size="sm">
          {language.nativeName}
        </QTag>
        <span className="inline-flex items-center gap-1">
          <Clock size={15} strokeWidth={1.75} aria-hidden />
          {formatReadingTime(piece.readingTimeSeconds)}
        </span>
        <Stat icon={Hand} value={stats.claps} label="claps" />
        <Stat icon={MessageCircle} value={stats.comments} label="comments" />
        <VisibilityIndicator visibility={piece.visibility} />
      </footer>
    </QCard>
  );
});
