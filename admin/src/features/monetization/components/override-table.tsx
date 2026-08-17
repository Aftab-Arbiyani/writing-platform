import { OverrideEffect } from '@qalam/shared';
import { QButton, QTag, useToast } from '@qalam/ui';
import { useState, type ReactElement } from 'react';

import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/status-badge';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

import { useRevokeOverride } from '../hooks/use-monetization';
import { isEnforcedCode } from '../lib/plan-provenance';
import type { AdminEntitlementOverride } from '../types/monetization.types';

/**
 * A user's active entitlement overrides, with revoke (A1a).
 *
 * Revoke confirms and names what the user falls back to, because the consequence is not symmetrical
 * with the grant: revoking an `allow` takes access away, while revoking a `deny` gives it back. One
 * generic "are you sure" for both would be telling the operator nothing.
 */
export interface OverrideTableProps {
  overrides: AdminEntitlementOverride[];
}

export function OverrideTable({ overrides }: OverrideTableProps): ReactElement {
  const toast = useToast();
  const revoke = useRevokeOverride();
  const [pending, setPending] = useState<AdminEntitlementOverride | null>(null);

  if (overrides.length === 0) {
    return (
      <EmptyState
        title="No active overrides"
        description="This account's entitlements come entirely from its plan."
        minHeight={180}
      />
    );
  }

  const confirm = (): void => {
    if (pending === null) return;
    revoke.mutate(pending.id, {
      onSuccess: () => {
        toast.success(`Override revoked: ${pending.feature}.`);
        setPending(null);
      },
      onError: (error) => {
        toast.error(getErrorMessage(error));
        setPending(null);
      },
    });
  };

  return (
    <>
      <ul className="flex flex-col divide-y divide-line">
        {overrides.map((override) => (
          <li
            key={override.id}
            className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <code className="font-mono text-sm text-ink">{override.feature}</code>
                <StatusBadge
                  status={override.effect}
                  tone={override.effect === OverrideEffect.Deny ? 'danger' : 'success'}
                />
                {override.active ? null : <QTag color="neutral">inactive</QTag>}
                {isEnforcedCode(override.feature) ? null : (
                  <QTag color="warning">not enforced</QTag>
                )}
              </span>
              <span className="text-xs text-ink-muted">
                Granted {formatDateTime(override.createdAt)}
                {override.expiresAt === null
                  ? ' · no expiry'
                  : ` · expires ${formatDateTime(override.expiresAt)}`}
              </span>
              {override.reason === null ? null : (
                <span className="text-xs text-ink-secondary">{override.reason}</span>
              )}
            </div>
            <QButton
              variant="secondary"
              size="sm"
              onClick={() => {
                setPending(override);
              }}
            >
              Revoke
            </QButton>
          </li>
        ))}
      </ul>

      <ConfirmationDialog
        open={pending !== null}
        danger
        title="Revoke this override?"
        confirmLabel="Revoke"
        loading={revoke.isPending}
        message={
          pending === null ? null : (
            <span className="flex flex-col gap-1">
              <span>
                <code className="font-mono">{pending.feature}</code> falls back to whatever the
                user&rsquo;s plan grants.
                {pending.effect === OverrideEffect.Deny
                  ? ' This override was a DENY, so revoking it may RESTORE access.'
                  : ' This override was an ALLOW, so revoking it may REMOVE access.'}
              </span>
              <span>
                Cached entitlements refresh within about a minute, so the change may not be visible
                in their app immediately.
              </span>
            </span>
          )
        }
        onConfirm={confirm}
        onCancel={() => {
          setPending(null);
        }}
      />
    </>
  );
}
