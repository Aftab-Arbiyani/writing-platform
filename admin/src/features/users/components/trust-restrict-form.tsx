import { RestrictionScope, RestrictionType } from '@qalam/shared';
import { QButton, QCard, QSectionHeader, useToast } from '@qalam/ui';
import { useState, type ReactElement } from 'react';

import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { getErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';

import { useApplyRestriction } from '../hooks/use-trust';
import {
  restrictionEffect,
  restrictionScopeLabel,
  restrictionTypeLabel,
} from '../lib/trust-labels';
import type { ApplyRestrictionPayload } from '../types/trust.types';

/**
 * Apply an account restriction (`POST /admin/users/:id/restrictions`).
 *
 * **Permanent is the DEFAULT here, and that is the trap.** An empty expiry means the restriction
 * stays until someone lifts it — the server stores `null` and treats it as active forever — so a
 * 7-day mute and a permanent one differ by a field an operator can simply not fill in. The
 * confirmation therefore never says "expires: —"; it says either "until <date>" or, in as many
 * words, that nothing will end this but a person.
 *
 * Both selects are built from the shared enums, so they can only offer values the server's
 * `@IsIn(...)` accepts. `suspended` is offered because it is a real member of `RestrictionType`;
 * what it is NOT is the account suspension on the same screen, which the panel above explains.
 */
const TYPES = Object.values(RestrictionType);
const SCOPES = Object.values(RestrictionScope);

export interface TrustRestrictFormProps {
  userId: string;
}

export function TrustRestrictForm({ userId }: TrustRestrictFormProps): ReactElement {
  const toast = useToast();
  const apply = useApplyRestriction();
  const [type, setType] = useState<RestrictionType>(RestrictionType.Muted);
  const [scope, setScope] = useState<RestrictionScope>(RestrictionScope.Global);
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [confirming, setConfirming] = useState(false);

  const permanent = expiresAt === '';
  const canSubmit = reason.trim() !== '';
  const effect = restrictionEffect(type);

  const submit = (): void => {
    const payload: ApplyRestrictionPayload = {
      type,
      scope,
      reason: reason.trim(),
      ...(permanent ? {} : { expiresAt: new Date(expiresAt).toISOString() }),
    };
    apply.mutate(
      { userId, payload },
      {
        onSuccess: () => {
          toast.success(`${restrictionTypeLabel(type)} applied (${restrictionScopeLabel(scope)}).`);
          setReason('');
          setExpiresAt('');
          setConfirming(false);
        },
        onError: (error) => {
          toast.error(getErrorMessage(error));
          setConfirming(false);
        },
      },
    );
  };

  return (
    <QCard as="section" padding="md" className="flex flex-col gap-4">
      <QSectionHeader
        title="Apply a restriction"
        description="Enforced by the Policy Engine on every action the scope covers."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="restriction-type" className="text-sm font-medium text-ink">
            Restriction
          </label>
          <select
            id="restriction-type"
            value={type}
            onChange={(event) => {
              setType(event.target.value as RestrictionType);
            }}
            className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
          >
            {TYPES.map((value) => (
              <option key={value} value={value}>
                {restrictionTypeLabel(value)}
              </option>
            ))}
          </select>
          {effect !== undefined ? (
            <span className="text-xs text-ink-secondary">{effect}</span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="restriction-scope" className="text-sm font-medium text-ink">
            Applies to
          </label>
          <select
            id="restriction-scope"
            value={scope}
            onChange={(event) => {
              setScope(event.target.value as RestrictionScope);
            }}
            className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
          >
            {SCOPES.map((value) => (
              <option key={value} value={value}>
                {restrictionScopeLabel(value)}
              </option>
            ))}
          </select>
          <span className="text-xs text-ink-muted">
            &ldquo;Everywhere&rdquo; covers every surface; any other scope limits the restriction to
            writes on that one.
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="restriction-expires" className="text-sm font-medium text-ink">
            Ends on <span className="text-ink-muted">(optional)</span>
          </label>
          <input
            id="restriction-expires"
            type="date"
            value={expiresAt}
            onChange={(event) => {
              setExpiresAt(event.target.value);
            }}
            className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
          />
          <span className={permanent ? 'text-xs text-warning' : 'text-xs text-ink-muted'}>
            {permanent
              ? 'Empty means PERMANENT: it stays in force until someone lifts it by hand.'
              : `Lifts itself on ${formatDate(expiresAt)}.`}
          </span>
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="restriction-reason" className="text-sm font-medium text-ink">
            Reason <span className="text-ink-muted">(required, recorded in the audit trail)</span>
          </label>
          <textarea
            id="restriction-reason"
            rows={2}
            maxLength={1000}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
          <span className="text-xs text-ink-muted">
            The user is notified and can see this reason, so write it for them.
          </span>
        </div>
      </div>

      <div>
        <QButton
          variant="danger"
          disabled={!canSubmit}
          loading={apply.isPending && !confirming}
          onClick={() => {
            setConfirming(true);
          }}
        >
          Apply restriction
        </QButton>
      </div>

      <ConfirmationDialog
        open={confirming}
        danger
        title={
          permanent
            ? `Apply a PERMANENT ${restrictionTypeLabel(type).toLowerCase()} restriction?`
            : `Apply a ${restrictionTypeLabel(type).toLowerCase()} restriction until ${formatDate(expiresAt)}?`
        }
        confirmLabel={permanent ? 'Apply permanently' : 'Apply until that date'}
        loading={apply.isPending}
        message={
          <span className="flex flex-col gap-2">
            <span>
              {restrictionTypeLabel(type)} · {restrictionScopeLabel(scope)}
              {effect === undefined ? '' : ` — ${effect}`}
            </span>
            <span>
              {permanent
                ? 'It has NO end date. Nothing expires it: it stays in force until an operator lifts it.'
                : `It ends by itself on ${formatDate(expiresAt)}, and can be lifted sooner.`}
            </span>
            {type === RestrictionType.Suspended ? (
              <span>
                This is the trust suspension, not the account suspension: they can still sign in and
                read. Blocking sign-in is the separate Suspend action on the account.
              </span>
            ) : null}
            <span>The user is notified, with the reason above.</span>
          </span>
        }
        onConfirm={submit}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </QCard>
  );
}
