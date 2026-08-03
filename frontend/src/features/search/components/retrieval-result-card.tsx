import type { SearchResultItem } from '@qalam/api-types';
import { QCard, QTag } from '@qalam/ui';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { piecePath, profilePath } from '@/lib/routes';

import { entityTypeLabel } from '../lib/retrieval-labels';
import { EvidenceList, RankingLine, RelatedEntities } from './retrieval-widgets';

/**
 * One ranked, grounded AF4 search result (W5). Mobile's `SearchResultCard` is the reference: title +
 * type, summary, the ranking line, related entities, evidence.
 *
 * **Navigation follows the server's `navigation` target, and only where the web has a route.** The
 * wire's `kind` is open-ended (`piece`, `author`, `graph_node`, `chapter`, …) and the graph kinds
 * belong to surfaces the web does not have yet (Story Explorer is W6). So a result whose target the
 * web cannot open renders as a plain card rather than a dead link — mobile shows a detail sheet in
 * that case, which is [48 §4.1] arrangement-difference territory, not a missing feature.
 */
export function RetrievalResultCard({ item }: { item: SearchResultItem }): ReactElement {
  const href = webTargetFor(item);
  const label = entityTypeLabel(item.type);

  const body = (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <h3 dir="auto" className="font-serif text-lg font-semibold text-ink">
          {item.title}
        </h3>
        <QTag color="accent">{label}</QTag>
      </div>

      {item.summary !== '' ? (
        <p dir="auto" className="line-clamp-3 text-sm text-ink-secondary">
          {item.summary}
        </p>
      ) : null}

      <RankingLine summary={item.reason} score={item.relevanceScore} />
      <RelatedEntities entities={item.relatedEntities} />
      <EvidenceList evidence={item.evidence} className="border-line border-t pt-2" />
    </div>
  );

  // A card that navigates is one link around the whole card, so the accessible name is the title
  // and the type — not five separate focus stops for one result.
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
 * The web route for a result's navigation target, or null when the web has nowhere to send it.
 *
 * `piece` refs are a slug (the recommender and the metadata retriever both prefer the slug), which is
 * exactly what `/p/:slug` takes. Authors are addressed by username. Everything else — graph nodes,
 * chapters, timeline cues — has no web surface until W6, and inventing one here would be scope.
 */
function webTargetFor(item: SearchResultItem): string | null {
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
