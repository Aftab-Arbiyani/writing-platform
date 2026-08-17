import { OverrideEffect, PremiumFeature } from '@qalam/shared';
import { QButton, QCard, QSectionHeader, useToast } from '@qalam/ui';
import { useState, type ReactElement } from 'react';

import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { getErrorMessage } from '@/lib/errors';

import { useGrantOverride } from '../hooks/use-monetization';
import { isEnforcedCode } from '../lib/plan-provenance';
import type { GrantOverridePayload } from '../types/monetization.types';

/**
 * Grant an entitlement override (A1a).
 *
 * **The feature select is built from `PremiumFeature` itself**, not from a hand-written list, so it
 * can only ever offer codes the server's `@IsIn(Object.values(PremiumFeature))` will accept. A typed
 * code would 422; an invented one could never be granted at all.
 *
 * **A `deny` effect confirms as destructive, and that is not in the obvious reading of "grant".** An
 * override outranks the plan (`entitlement.service.ts:177`), so denying a code a paying subscriber's
 * tier includes REMOVES access they paid for. It is the same shape of action as a revoke and gets the
 * same guard.
 *
 * Each code is marked with whether any server route asserts it, because granting one of D4's six
 * unenforced codes changes nothing today and the operator should know that before they promise a user
 * it will.
 */
const FEATURE_CODES = Object.values(PremiumFeature);
const EFFECTS = Object.values(OverrideEffect);

export interface OverrideGrantFormProps {
  userId: string;
}

export function OverrideGrantForm({ userId }: OverrideGrantFormProps): ReactElement {
  const toast = useToast();
  const grant = useGrantOverride();
  const [feature, setFeature] = useState<string>(PremiumFeature.AiWriting);
  const [effect, setEffect] = useState<string>(OverrideEffect.Allow);
  const [expiresAt, setExpiresAt] = useState('');
  const [reason, setReason] = useState('');
  const [source, setSource] = useState('');
  const [confirming, setConfirming] = useState(false);

  const denying = effect === OverrideEffect.Deny;
  const enforced = isEnforcedCode(feature);

  const submit = (): void => {
    const payload: GrantOverridePayload = {
      userId,
      feature: feature as PremiumFeature,
      effect: effect as OverrideEffect,
      ...(expiresAt === '' ? {} : { expiresAt: new Date(expiresAt).toISOString() }),
      ...(reason.trim() === '' ? {} : { reason: reason.trim() }),
      ...(source.trim() === '' ? {} : { source: source.trim() }),
    };
    grant.mutate(payload, {
      onSuccess: () => {
        toast.success(`Override granted: ${effect} ${feature}.`);
        setReason('');
        setSource('');
        setExpiresAt('');
        setConfirming(false);
      },
      onError: (error) => {
        toast.error(getErrorMessage(error));
        setConfirming(false);
      },
    });
  };

  /** A deny is destructive; an allow is additive and applies straight away. */
  const start = (): void => {
    if (denying) {
      setConfirming(true);
      return;
    }
    submit();
  };

  return (
    <QCard padding="md" className="flex flex-col gap-4">
      <QSectionHeader
        title="Grant an override"
        description="Overrides outrank the user's plan, in both directions."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="override-feature" className="text-sm font-medium text-ink">
            Premium feature
          </label>
          <select
            id="override-feature"
            value={feature}
            onChange={(event) => {
              setFeature(event.target.value);
            }}
            className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
          >
            {FEATURE_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
                {isEnforcedCode(code) ? '' : ' — not enforced yet'}
              </option>
            ))}
          </select>
          {!enforced ? (
            <span className="text-xs text-warning">
              No server route asserts this code yet (D4 is deferred), so granting it will not change
              what the user can do.
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="override-effect" className="text-sm font-medium text-ink">
            Effect
          </label>
          <select
            id="override-effect"
            value={effect}
            onChange={(event) => {
              setEffect(event.target.value);
            }}
            className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
          >
            {EFFECTS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          {denying ? (
            <span className="text-xs text-danger">
              A deny override removes access the user&rsquo;s plan would otherwise grant.
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="override-expires" className="text-sm font-medium text-ink">
            Expires at <span className="text-ink-muted">(optional)</span>
          </label>
          <input
            id="override-expires"
            type="date"
            value={expiresAt}
            onChange={(event) => {
              setExpiresAt(event.target.value);
            }}
            className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
          />
          <span className="text-xs text-ink-muted">
            Leave empty for a permanent override. Use a date for promotional or temporary access.
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="override-source" className="text-sm font-medium text-ink">
            Source <span className="text-ink-muted">(optional)</span>
          </label>
          <input
            id="override-source"
            type="text"
            maxLength={120}
            placeholder="promotional / support / temporary"
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
            }}
            className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
          />
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="override-reason" className="text-sm font-medium text-ink">
            Reason <span className="text-ink-muted">(optional, recorded in the audit trail)</span>
          </label>
          <input
            id="override-reason"
            type="text"
            maxLength={255}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
            className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-ink"
          />
        </div>
      </div>

      <div>
        <QButton
          variant={denying ? 'danger' : 'primary'}
          loading={grant.isPending && !confirming}
          onClick={start}
        >
          {denying ? 'Deny feature' : 'Grant override'}
        </QButton>
      </div>

      <ConfirmationDialog
        open={confirming}
        danger
        title="Deny this feature for the user?"
        confirmLabel="Deny access"
        loading={grant.isPending}
        message={
          <span className="flex flex-col gap-1">
            <span>
              A deny override on <code className="font-mono">{feature}</code> outranks the
              user&rsquo;s plan, so they lose this feature even if their tier includes it.
            </span>
            <span>
              Cached entitlements refresh within about a minute, so their app may still show access
              briefly.
            </span>
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
