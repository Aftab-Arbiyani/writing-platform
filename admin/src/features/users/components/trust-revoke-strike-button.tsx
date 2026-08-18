import { QButton, useToast } from '@qalam/ui';
import { Undo2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { getErrorMessage } from '@/lib/errors';

import { useRevokeStrike } from '../hooks/use-trust';
import { strikeSeverityLabel } from '../lib/trust-labels';
import type { AdminStrike } from '../types/trust.types';

/**
 * Revoke one strike (`DELETE /admin/strikes/:id`) — confirms first, like every other mutation on
 * this tab. Added by B9 to close A2-2's write half.
 *
 * **It sends the STRIKE's id, not the user's**, on the same footing as `TrustLiftButton`: the
 * component takes the whole row so a caller cannot pass an id at all, and the hook's variable is
 * named `strikeId`.
 *
 * The confirmation states the consequence that distinguishes this from lifting a restriction:
 * **revoking is the only action that lowers the active strike weight.** It says the resulting
 * weight, and — when the account is currently over an escalation threshold — that any restriction
 * already applied stays in force until it is lifted separately. Dropping below the threshold does
 * not undo a sanction an operator may have separately confirmed, and an operator expecting a revoke
 * to release a suspension would otherwise be surprised.
 */
export interface TrustRevokeStrikeButtonProps {
  strike: AdminStrike;
  /**
   * The standing's current active weight, so the dialog can state where the revoke lands. The
   * server recomputes from the rows; this figure is only for the sentence.
   */
  activeStrikeWeight: number;
  /** True when a global restriction is in force, which a revoke does NOT lift. */
  restrictionInForce: boolean;
}

export function TrustRevokeStrikeButton({
  strike,
  activeStrikeWeight,
  restrictionInForce,
}: TrustRevokeStrikeButtonProps): ReactElement {
  const toast = useToast();
  const revoke = useRevokeStrike();
  const [confirming, setConfirming] = useState(false);

  const remaining = Math.max(0, activeStrikeWeight - strike.weight);

  const submit = (): void => {
    revoke.mutate(
      { strikeId: strike.id },
      {
        onSuccess: () => {
          toast.success('Strike revoked.');
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
    <>
      <QButton
        variant="secondary"
        size="sm"
        icon={Undo2}
        loading={revoke.isPending && !confirming}
        onClick={() => {
          setConfirming(true);
        }}
      >
        Revoke
      </QButton>

      <ConfirmationDialog
        open={confirming}
        title="Revoke this strike?"
        confirmLabel="Revoke strike"
        loading={revoke.isPending}
        message={
          <span className="flex flex-col gap-2">
            <span>
              {strikeSeverityLabel(strike.severity)} — <bdi>{strike.reason}</bdi>
            </span>
            <span>
              It stops counting and stays on the record as history. Their active strike weight goes
              from {activeStrikeWeight} to {remaining}, and their score is recalculated from what is
              left. This is the only action that lowers the weight.
            </span>
            {restrictionInForce ? (
              <span>
                A restriction is currently in force and this does <strong>not</strong> lift it, even
                if the weight now falls below the threshold that applied it. Lift it from the
                restriction list if that is what you intend.
              </span>
            ) : null}
          </span>
        }
        onConfirm={submit}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </>
  );
}
