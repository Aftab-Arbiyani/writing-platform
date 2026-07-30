import { QAvatar, QCard, QTag } from '@qalam/ui';
import { Clock, Hand, Link2, Lock, MessageCircle } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import { Link } from 'react-router';

import { formatCount, formatReadingTime, formatRelativeTime } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import { piecePath } from '@/lib/routes';

import type { PieceSummary } from '../types/search.types';
import { HighlightText } from './highlight-text';

/** Read-only engagement stat (claps / comments) — no action buttons here (engagement epic owns those). */
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
      <Icon size={14} strokeWidth={1.75} aria-hidden />
      <span className="tabular-nums">{formatCount(value)}</span>
    </span>
  );
}

function VisibilityIndicator({
  visibility,
}: {
  visibility: PieceSummary['visibility'];
}): ReactElement | null {
  if (visibility === 'public') return null;
  const isPrivate = visibility === 'private';
  const Icon = isPrivate ? Lock : Link2;
  return (
    <span className="inline-flex items-center gap-1 text-ink-muted">
      <Icon size={13} strokeWidth={1.75} aria-hidden />
      {isPrivate ? 'Private' : 'Unlisted'}
    </span>
  );
}

/**
 * A COMPACT piece card for search results + discovery rows (docs/06 §3.6 — "PieceCard compact,
 * highlighted match snippet"). Distinct from the feed's full `PieceCard` (which owns a big
 * cover): here a small side thumbnail keeps result lists dense. The title highlights the query
 * match; the whole card is a stretched link to the reading view (one focus stop). Text flips to
 * the piece's script via `dir`/`lang`; the grid never flips (docs/06 §6.6). `memo` — lists grow.
 */
export const PieceResultCard = memo(function PieceResultCard({
  piece,
  query = '',
}: {
  piece: PieceSummary;
  query?: string;
}): ReactElement {
  const { author, language, genre, stats } = piece;
  const displayName = author.penName ?? `@${author.username}`;
  const href = piecePath(piece.slug ?? piece.id);
  const cover = mediaUrl(piece.coverImageKey);
  const snippet = piece.subtitle ?? piece.featuredQuote;

  return (
    <QCard as="article" interactive padding="md" className="relative flex gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <header className="flex items-center gap-2 text-xs text-ink-secondary">
          <QAvatar size={24} src={mediaUrl(author.avatarKey)} name={displayName} />
          <span className="flex flex-wrap items-center gap-x-1.5">
            <span className="font-medium text-ink">{displayName}</span>
            {piece.publishedAt ? (
              <>
                <span aria-hidden>·</span>
                <time dateTime={piece.publishedAt}>{formatRelativeTime(piece.publishedAt)}</time>
              </>
            ) : null}
          </span>
        </header>

        <h3 className="font-serif text-lg font-semibold leading-snug text-ink">
          <Link
            to={href}
            dir={language.direction}
            lang={language.code}
            className="rounded-sm after:absolute after:inset-0 after:content-['']"
          >
            <HighlightText text={piece.title} query={query} />
          </Link>
        </h3>

        {snippet ? (
          <p dir="auto" className="line-clamp-2 text-sm text-ink-secondary">
            {snippet}
          </p>
        ) : null}

        <footer className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-muted">
          {genre ? (
            <QTag color="neutral" size="sm">
              {genre.name}
            </QTag>
          ) : null}
          <QTag color="neutral" size="sm">
            {language.nativeName}
          </QTag>
          <span className="inline-flex items-center gap-1">
            <Clock size={14} strokeWidth={1.75} aria-hidden />
            {formatReadingTime(piece.readingTimeSeconds)}
          </span>
          <Stat icon={Hand} value={stats.claps} label="claps" />
          <Stat icon={MessageCircle} value={stats.comments} label="comments" />
          <VisibilityIndicator visibility={piece.visibility} />
        </footer>
      </div>

      {cover ? (
        <div className="hidden shrink-0 overflow-hidden rounded-md bg-raised sm:block">
          <img
            src={cover}
            alt=""
            width={120}
            height={120}
            loading="lazy"
            className="size-[92px] object-cover dark:brightness-[0.92]"
          />
        </div>
      ) : null}
    </QCard>
  );
});
