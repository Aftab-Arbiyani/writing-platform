import { POLICY_ACTIONS, SuggestionStatus } from '@qalam/shared';
import { QButton, QCard, QTag, type QTagColor } from '@qalam/ui';
import type { ReactElement } from 'react';

import { formatRelativeTime } from '@/lib/format';
import { useMe } from '@/hooks/use-me';

import { isSuggestionConflict, useSuggestionActions } from '../hooks/use-suggestions';
import type { EditSuggestion } from '../types/collaboration.types';
import { CapabilityGate } from './capability-gate';
import { CollaboratorIdentity } from './collaborator-identity';

/**
 * One proposed edit (AF6, W3b): the text it replaces, the text it proposes, and the decision.
 *
 * **Accepting rewrites the prose.** Since commit `f6827e0`, `POST /suggestions/:id/accept` replaces
 * the anchored range of the piece body with `suggestedText` in the same transaction that settles the
 * suggestion, capturing a `pre_edit` snapshot first; a stale anchor is refused with
 * `SUGGESTION_CONFLICT` and writes nothing. So an accepted card says the change has landed.
 *
 * It said the opposite until this fix (defect **W3c-4**, docs/48 §3.4) — and the E2E asserted the
 * stale wording, so the suite stayed green while the UI told the writer their prose was untouched.
 * The copy and its assertion move together for that reason. Mobile says the same thing at the same
 * moment ("Suggestion accepted.", reverted in mobile commit `dd12091`).
 */
const STATUS: Record<string, { label: string; color: QTagColor }> = {
  [SuggestionStatus.Pending]: { label: 'Pending', color: 'neutral' },
  [SuggestionStatus.Accepted]: { label: 'Accepted', color: 'success' },
  [SuggestionStatus.Rejected]: { label: 'Rejected', color: 'danger' },
  [SuggestionStatus.Withdrawn]: { label: 'Withdrawn', color: 'neutral' },
};

export interface SuggestionCardProps {
  storyId: string;
  suggestion: EditSuggestion;
}

export function SuggestionCard({ storyId, suggestion }: SuggestionCardProps): ReactElement {
  const { data: me } = useMe();
  const { acceptSuggestion, rejectSuggestion, withdrawSuggestion } = useSuggestionActions(storyId);

  const pending = suggestion.status === SuggestionStatus.Pending;
  const isAuthor = suggestion.authorId === me?.id;
  const status = STATUS[suggestion.status] ?? { label: suggestion.status, color: 'neutral' };
  const conflicted = isSuggestionConflict(acceptSuggestion.error);

  return (
    <QCard>
      <article className="flex flex-col gap-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <CollaboratorIdentity userId={suggestion.authorId} isSelf={isAuthor} />
          <div className="flex items-center gap-2">
            <QTag size="sm" color={status.color}>
              {status.label}
            </QTag>
            <span className="text-ink-muted text-xs">
              {formatRelativeTime(suggestion.createdAt)}
            </span>
          </div>
        </header>

        <div className="flex flex-col gap-2 text-sm">
          <div>
            <p className="text-ink-muted text-xs font-medium uppercase">Replaces</p>
            <p className="text-ink-secondary line-through">
              <bdi>{suggestion.originalText}</bdi>
            </p>
          </div>
          <div>
            <p className="text-ink-muted text-xs font-medium uppercase">With</p>
            <p className="text-ink">
              <bdi>{suggestion.suggestedText}</bdi>
            </p>
          </div>
        </div>

        {suggestion.status === SuggestionStatus.Accepted ? (
          // The one thing a writer must not have to guess about this surface: their prose changed.
          <p className="text-ink-muted text-xs">
            Accepted — the replacement was applied to the piece. The version before the edit was
            saved, so it can be reverted.
          </p>
        ) : null}

        {conflicted ? (
          <p role="alert" className="text-danger text-sm">
            The text this suggestion replaces has changed, so it can no longer be applied
            automatically. Reject it and ask for a fresh suggestion.
          </p>
        ) : null}

        {pending ? (
          <footer className="flex flex-wrap items-center gap-2">
            <CapabilityGate storyId={storyId} action={POLICY_ACTIONS.SuggestionResolve}>
              <QButton
                size="sm"
                loading={acceptSuggestion.isPending}
                onClick={() => acceptSuggestion.mutate(suggestion.id)}
              >
                Accept
              </QButton>
            </CapabilityGate>

            <CapabilityGate storyId={storyId} action={POLICY_ACTIONS.SuggestionResolve}>
              <QButton
                variant="secondary"
                size="sm"
                loading={rejectSuggestion.isPending}
                onClick={() => rejectSuggestion.mutate(suggestion.id)}
              >
                Reject
              </QButton>
            </CapabilityGate>

            {/* Withdraw is the author's own, authorized by authorship rather than a story role —
                the engine's self-service rule — so it is not capability-gated here. */}
            {isAuthor ? (
              <QButton
                variant="ghost"
                size="sm"
                loading={withdrawSuggestion.isPending}
                onClick={() => withdrawSuggestion.mutate(suggestion.id)}
              >
                Withdraw
              </QButton>
            ) : null}
          </footer>
        ) : null}
      </article>
    </QCard>
  );
}
