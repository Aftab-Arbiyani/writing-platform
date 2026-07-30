import { QTag } from '@qalam/ui';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router';

import { RouterLink } from '@/components/router-link';

import type { PieceSummary } from '../types/search.types';
import { PieceResultCard } from './piece-result-card';
import { ResultRowSkeleton } from './search-skeletons';
import { WriterListItem, type WriterListItemData } from './writer-list-item';

/**
 * The Discovery screen's building blocks (docs/06 §8). A `DiscoverSection` shell (heading + an
 * optional "see all" link) plus responsive grids for writers/pieces and a chip cloud for the
 * popular taxonomy. Each is public and skips itself when empty so the page never shows a hollow
 * heading. Grids are 1-col on mobile → 2-col on md (docs/06 §8, §11).
 */

export function DiscoverSection({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-serif text-xl font-semibold text-ink">
          {Icon ? <Icon size={20} strokeWidth={1.75} className="text-accent" aria-hidden /> : null}
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function GridSkeleton({ count = 4 }: { count?: number }): ReactElement {
  return (
    <div aria-hidden className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <ResultRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function WritersGrid({
  items,
  isLoading,
}: {
  items: WriterListItemData[];
  isLoading: boolean;
}): ReactElement {
  if (isLoading) return <GridSkeleton />;
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map((writer) => (
        <li key={writer.username}>
          <WriterListItem writer={writer} />
        </li>
      ))}
    </ul>
  );
}

export function PiecesGrid({
  items,
  isLoading,
}: {
  items: PieceSummary[];
  isLoading: boolean;
}): ReactElement {
  if (isLoading) return <GridSkeleton />;
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map((piece) => (
        <li key={piece.id}>
          <PieceResultCard piece={piece} />
        </li>
      ))}
    </ul>
  );
}

export interface TaxonomyChip {
  key: string;
  label: string;
  href: string;
}

export function TaxonomyCloud({ chips }: { chips: TaxonomyChip[] }): ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <QTag key={chip.key} color="neutral" size="md" href={chip.href} linkComponent={RouterLink}>
          {chip.label}
        </QTag>
      ))}
    </div>
  );
}

/** A "See all" text link used as a section action (deep-links into a filtered feed / search). */
export function SeeAllLink({ to, children }: { to: string; children: ReactNode }): ReactElement {
  return (
    <Link to={to} className="shrink-0 text-sm font-medium text-accent hover:underline">
      {children}
    </Link>
  );
}
