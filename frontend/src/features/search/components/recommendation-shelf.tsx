import type { RecommendationItem, RecommendationKind } from '@qalam/api-types';
import { QCard, QSkeleton, QTag } from '@qalam/ui';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { piecePath, profilePath } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';

import { useRecommendations } from '../hooks/use-retrieval';
import { entityTypeLabel } from '../lib/retrieval-labels';
import { DiscoverSection } from './discover-sections';
import { RankingLine } from './retrieval-widgets';

/**
 * One explainable recommendation (AF4 / W5). Mobile's `RecommendationCard` in its compact form is the
 * reference: title, what kind of thing it is, and — always — why it was recommended.
 *
 * **The reason is not decoration.** AF4's design law is that every recommendation explains itself, so
 * a card that dropped `reason` would be a ranked list pretending to be a recommendation. It is the
 * one field this renders unconditionally.
 */
function RecommendationCardView({ item }: { item: RecommendationItem }): ReactElement {
  const href = webTargetFor(item);
  const label = entityTypeLabel(item.targetType);

  const body = (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <h3 dir="auto" className="line-clamp-2 font-serif text-base font-semibold text-ink">
          {item.title}
        </h3>
        <QTag color="accent">{label}</QTag>
      </div>
      {item.summary !== '' ? (
        <p dir="auto" className="line-clamp-2 text-sm text-ink-secondary">
          {item.summary}
        </p>
      ) : null}
      <RankingLine summary={item.reason} score={item.score} />
    </div>
  );

  return href !== null ? (
    <QCard>
      <Link
        to={href}
        className="block focus-visible:outline-none"
        aria-label={`${label}: ${item.title}`}
      >
        {body}
      </Link>
    </QCard>
  ) : (
    <QCard>{body}</QCard>
  );
}

/**
 * A shelf of recommendations for one surface (`GET /ai/recommendations?kind=…`).
 *
 * **Silent unless it has something to say.** It renders nothing for a signed-out reader, and nothing
 * when the set comes back empty. That is the same rule the editorial sections on this page already
 * follow: a hollow heading is worse than no heading.
 *
 * The signed-out check is a REQUEST gate, not just a render gate. `/ai/recommendations` still needs
 * a session, and firing it anonymously would 401 — which on a public page is not harmless, because
 * the api layer's `onUnauthorized()` drops the session on the way past. Before D5 the feature-flag
 * hop happened to prevent that; the flag is gone, so the gate has to be stated.
 *
 * It deliberately does NOT explain its own absence. Discover is a public editorial surface that
 * works without recommendations; a notice about a feature nobody asked for would be noise.
 */
export function RecommendationShelf({
  kind,
  title,
  icon,
  limit = 6,
}: {
  kind: RecommendationKind;
  title: string;
  icon: LucideIcon;
  limit?: number;
}): ReactElement | null {
  const authed = useAuthStore((s) => s.status) === 'authenticated';
  const { data, isLoading, isError } = useRecommendations({ kind, limit, enabled: authed });

  if (!authed || isError) return null;
  if (isLoading) {
    return (
      <DiscoverSection title={title} icon={icon}>
        <div aria-hidden className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <QCard key={i} padding="md">
              <QSkeleton variant="title" width="70%" />
              <QSkeleton variant="text" lines={2} />
            </QCard>
          ))}
        </div>
      </DiscoverSection>
    );
  }

  const items = data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <DiscoverSection title={title} icon={icon}>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={`${item.kind}:${item.id}`}>
            <RecommendationCardView item={item} />
          </li>
        ))}
      </ul>
    </DiscoverSection>
  );
}

/**
 * The web route for a recommendation's navigation target, or null.
 *
 * Pieces and authors have routes; genres and topics resolve to a filtered feed on the editorial
 * shelves already, and the graph kinds (`character`, `chapter`, `concept`) belong to W6's surfaces.
 * A target the web cannot open renders as a plain card rather than a link to nowhere.
 */
function webTargetFor(item: RecommendationItem): string | null {
  const ref = item.navigation.ref;
  if (ref === '') return null;
  switch (item.navigation.kind) {
    case 'piece':
      return piecePath(ref);
    case 'author':
      return profilePath(ref);
    default:
      return null;
  }
}
