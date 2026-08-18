import { QButton, useToast } from '@qalam/ui';
import { Undo2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { getErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';

import { useLiftRestriction } from '../hooks/use-trust';
import { restrictionScopeLabel, restrictionTypeLabel } from '../lib/trust-labels';
import type { AdminRestriction } from '../types/trust.types';

/**
 * Lift one restriction (`DELETE /admin/restrictions/:id`) — confirms first.
 *
 * **It sends the RESTRICTION's id, not the user's.** Four of the five trust routes are keyed by
 * user and this one is not; both are UUIDs, so the wrong one produces a 404 rather than a type
 * error. The component takes the whole restriction row precisely so a caller cannot pass an id at
 * all, and the hook's variable is named `restrictionId`.
 *
 * The confirmation says the one thing that is easy to get wrong about lifting: **the strike weight
 * does not move.** If the restriction was applied automatically at a strike threshold, the weight
 * that triggered it is still there, so the next strike re-applies it (`maybeEscalate` runs on every
 * strike and only skips when a matching restriction is already ACTIVE).
 *
 * That was recorded as defect A2-3 and B9 kept it, deliberately: lifting means "you may act again",
 * revoking a strike means "that strike was wrong", and conflating them would erase a real violation
 * record. What B9 changed is that the copy can now name the remedy instead of only warning about the
 * consequence — the strike list below has a Revoke action, and it is the only thing that lowers the
 * weight.
 */
export interface TrustLiftButtonProps {
  restriction: AdminRestriction;
}

export function TrustLiftButton({ restriction }: TrustLiftButtonProps): ReactElement {
  const toast = useToast();
  const lift = useLiftRestriction();
  const [confirming, setConfirming] = useState(false);

  const label = restrictionTypeLabel(restriction.type);

  const submit = (): void => {
    lift.mutate(
      { restrictionId: restriction.id },
      {
        onSuccess: () => {
          toast.success(`${label} lifted.`);
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
        loading={lift.isPending && !confirming}
        onClick={() => {
          setConfirming(true);
        }}
      >
        Lift
      </QButton>

      <ConfirmationDialog
        open={confirming}
        title={`Lift the ${label.toLowerCase()} restriction?`}
        confirmLabel="Lift restriction"
        loading={lift.isPending}
        message={
          <span className="flex flex-col gap-2">
            <span>
              {label} · {restrictionScopeLabel(restriction.scope)} —{' '}
              {restriction.expiresAt === null
                ? 'no end date'
                : `would have ended ${formatDate(restriction.expiresAt)}`}
              .
            </span>
            <span>
              It stops applying immediately and stays on the record as history. Their active strike
              weight is unchanged, so if a strike threshold applied this restriction, the next
              strike applies it again. To lower the weight, revoke the strikes in the list above.
            </span>
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
