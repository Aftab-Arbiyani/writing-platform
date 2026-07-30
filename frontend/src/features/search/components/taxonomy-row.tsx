import { QCard } from '@qalam/ui';
import { ChevronRight } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import { Link } from 'react-router';

import { formatCount } from '@/lib/format';

import { HighlightText } from './highlight-text';

/**
 * One tag / genre / language result row. The whole row links to the filtered Latest feed
 * (`/feed?tag=…` / `?genre=…` / `?lang=…`) — the documented `/tag`·`/genre` behavior (docs/06
 * §3.6), reusing F3 rather than inventing a q-less piece search (piece search requires a query).
 * The title highlights the query match; the piece count is shown right-aligned.
 */
export const TaxonomyRow = memo(function TaxonomyRow({
  href,
  title,
  query = '',
  count,
  countNoun,
}: {
  href: string;
  title: string;
  query?: string;
  count: number;
  /** Singular noun for the count (e.g. "piece") — pluralized with a trailing s when count ≠ 1. */
  countNoun: string;
}): ReactElement {
  return (
    <QCard as="article" interactive padding="md" className="relative flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-medium text-ink">
          <Link to={href} className="rounded-sm after:absolute after:inset-0 after:content-['']">
            <HighlightText text={title} query={query} />
          </Link>
        </h3>
        <p className="text-xs text-ink-muted tabular-nums">
          {formatCount(count)} {count === 1 ? countNoun : `${countNoun}s`}
        </p>
      </div>
      <ChevronRight
        size={18}
        strokeWidth={1.5}
        className="shrink-0 text-ink-muted rtl:rotate-180"
        aria-hidden
      />
    </QCard>
  );
});
