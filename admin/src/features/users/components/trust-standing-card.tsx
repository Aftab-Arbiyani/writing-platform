import {
  STRIKE_RESTRICTION_THRESHOLD,
  STRIKE_SUSPENSION_THRESHOLD,
  TRUST_SCORE_MAX,
  TRUST_SCORE_MIN,
} from '@qalam/shared';
import { QCard, QSectionHeader, QTag, cn } from '@qalam/ui';
import type { ReactElement } from 'react';

import { StatCard } from '@/components/stat-card';

import { bandForScore, bandRange, TRUST_BANDS, type TrustBand } from '../lib/trust-standing';
import { trustLevelLabel, trustStatusTag } from '../lib/trust-labels';
import type { AdminTrustSummary } from '../types/trust.types';

/**
 * The reputation score against its scale.
 *
 * **A bare number is meaningless to an operator.** "62" only means something next to "Member,
 * 50–79" and the two boundaries either side of it, so the score is never rendered alone: the
 * bands are drawn in order with the current one marked, and the score's own position is stated
 * numerically for anyone who cannot see the strip.
 *
 * The bands come from `trustLevelForScore` in `@qalam/shared`, so this cannot drift from the
 * server's tiering. Band membership is conveyed by the tag and the text, never by colour alone.
 */
function ScoreScale({ score, level }: { score: number; level: string }): ReactElement {
  const current = bandForScore(score);
  // `level` is the server's own stored tier. It is normally the band the score falls in, and when
  // it is not (a stale `trust_profiles.level`) the server's value wins — it is what the rest of the
  // platform reads — so the disagreement is shown rather than silently corrected.
  const drifted = level !== current.level;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-3xl font-semibold text-ink [font-variant-numeric:tabular-nums]">
          {score}
        </span>
        <span className="text-sm text-ink-muted">
          of {TRUST_SCORE_MAX} · {trustLevelLabel(level)}
          {drifted ? null : ` (${bandRange(current)})`}
        </span>
      </div>

      <ol className="flex flex-col gap-1" aria-label="Reputation bands">
        {TRUST_BANDS.map((band: TrustBand) => {
          const isCurrent = band.level === current.level;
          return (
            <li key={band.level} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  'h-1.5 w-16 flex-shrink-0 rounded-full',
                  isCurrent ? 'bg-accent' : 'bg-raised',
                )}
                aria-hidden
              />
              <span className={cn(isCurrent ? 'font-semibold text-ink' : 'text-ink-muted')}>
                {band.label} {bandRange(band)}
                {isCurrent ? ' — current' : ''}
              </span>
            </li>
          );
        })}
      </ol>

      {drifted ? (
        <p className="text-xs text-warning">
          The stored tier ({trustLevelLabel(level)}) does not match the band this score falls in (
          {current.label} {bandRange(current)}). The stored tier is what the platform reads.
        </p>
      ) : null}
      <p className="text-xs text-ink-muted">
        Scores run {TRUST_SCORE_MIN}–{TRUST_SCORE_MAX} and start at 50. Each strike lowers the score
        in proportion to its weight.
      </p>
    </div>
  );
}

/**
 * A user's trust standing (`GET /admin/users/:id/trust`) — score against its scale, the effective
 * status the Policy Engine sees, and the active strike weight against the two thresholds that
 * escalate automatically.
 *
 * The active restrictions this DTO carries are deliberately not listed here: the restriction list
 * beside it renders active AND historical rows from the other read, and showing the active subset
 * twice would invite reading one of them as the whole history.
 */
export function TrustStandingCard({ summary }: { summary: AdminTrustSummary }): ReactElement {
  const status = trustStatusTag(summary.status);

  return (
    <QCard as="section" padding="md" className="flex flex-col gap-4">
      <QSectionHeader
        title="Standing"
        description="What the Policy Engine sees when it decides whether this account may act."
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-secondary">Standing</span>
        <QTag color={status.color} size="sm">
          {status.label}
        </QTag>
      </div>

      <ScoreScale score={summary.score} level={summary.level} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label="Active strike weight"
          value={summary.activeStrikeWeight}
          hint={`Restriction at ${STRIKE_RESTRICTION_THRESHOLD}, suspension at ${STRIKE_SUSPENSION_THRESHOLD} — both automatic.`}
        />
        <StatCard
          label="Restrictions in force"
          value={summary.restrictions.length}
          hint="Counted from the standing, which lists active rows only."
        />
      </div>
    </QCard>
  );
}
