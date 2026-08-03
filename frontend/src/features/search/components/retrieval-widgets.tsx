import { QTag, cn } from '@qalam/ui';
import { Quote, TrendingUp } from 'lucide-react';
import type { ReactElement } from 'react';

import type { RelatedEntity, RetrievalEvidence } from '@qalam/api-types';

/**
 * The grounding blocks every AF4 result and recommendation carries (W5, docs/36) — the reason it
 * surfaced, the entities that influenced it, and the evidence behind it.
 *
 * **These exist because the platform's design law says a result must explain itself.** The server
 * computes all of it (`reason`, `relevanceScore`, `evidence`, `relatedEntities`); the client renders
 * and never re-derives. Mobile's `retrieval_widgets.dart` is the reference — same three parts, same
 * order, arranged for a wider viewport.
 */

/**
 * Why this surfaced, plus how strongly.
 *
 * The score is rendered as a percentage **and** stated in the accessible name, because a bare bar
 * conveys nothing to a screen reader. It is deliberately not a `progressbar`: nothing is in
 * progress — this is a static measure of relevance.
 */
export function RankingLine({
  summary,
  score,
}: {
  summary: string;
  score: number;
}): ReactElement | null {
  if (summary === '') return null;
  const pct = Math.round(Math.min(1, Math.max(0, score)) * 100);
  return (
    <div className="flex items-start gap-2 text-sm text-ink-secondary">
      <TrendingUp size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
      <span>
        {summary}
        <span className="sr-only">{` — relevance ${String(pct)}%`}</span>
        <span aria-hidden className="ml-1 tabular-nums text-ink-muted">
          {pct}%
        </span>
      </span>
    </div>
  );
}

/**
 * The entities that influenced a result. Each is a plain tag rather than a link: the wire gives a
 * type + id, and only some of those types have a route on the web today — a tag that navigated
 * nowhere would be worse than one that clearly does not claim to.
 */
export function RelatedEntities({ entities }: { entities: RelatedEntity[] }): ReactElement | null {
  if (entities.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Related">
      {entities.slice(0, 6).map((entity) => (
        <li key={`${entity.type}:${entity.id}:${entity.name}`}>
          <QTag>
            {entity.name}
            <span className="sr-only">{` (${entity.relation})`}</span>
          </QTag>
        </li>
      ))}
    </ul>
  );
}

/**
 * The evidence a result is grounded in — the quoted text and where it came from.
 *
 * Capped at three and clamped to two lines each: this is the receipt, not the content. A reader who
 * wants more opens the result itself.
 */
export function EvidenceList({
  evidence,
  className,
}: {
  evidence: RetrievalEvidence[];
  className?: string;
}): ReactElement | null {
  if (evidence.length === 0) return null;
  return (
    <ul className={cn('flex flex-col gap-1.5', className)} aria-label="Evidence">
      {evidence.slice(0, 3).map((item) => (
        <li key={`${item.source}:${item.ref}`} className="flex items-start gap-2">
          <Quote
            size={13}
            strokeWidth={1.75}
            className="mt-1 shrink-0 text-ink-muted"
            aria-hidden
          />
          <p className="line-clamp-2 text-sm text-ink-secondary">
            <span className="text-ink">{item.label}</span>
            {item.quote !== '' && item.quote !== item.label ? ` — ${item.quote}` : null}
          </p>
        </li>
      ))}
    </ul>
  );
}
