import { COUPON_CODE_MAX, PlanTier, PromotionType } from '@qalam/shared';
import { QButton, QCard, QSectionHeader, useToast } from '@qalam/ui';
import { useState, type ReactElement } from 'react';

import { getErrorMessage, isApiError } from '@/lib/errors';

import { useCreateCoupon } from '../hooks/use-monetization';
import { couponValueHint } from '../lib/coupon-value';
import type { CreateCouponPayload } from '../types/monetization.types';

/**
 * Create a coupon (A1b).
 *
 * **`COUPON_CODE_TAKEN` is a field error on the code input, never a toast.** It is the one failure on
 * this form the operator can fix without leaving it — every other error is either a validation problem
 * the inputs already prevent or something outside their control. A toast for a fixable, field-specific
 * problem makes the operator hunt for which field, and it disappears while they are still looking.
 *
 * `type` and `value` are deliberately explained together, because `value` means something different
 * for each of the six types — a percentage, minor currency units, a credit count, or a number of days.
 * The hint comes from `couponValueHint`, which mirrors `PromotionService.describe`. Labelling the
 * field "Value" and stopping there invites a 20-cent discount where 20 percent was meant.
 */
const TYPES = Object.values(PromotionType);
const TIERS = Object.values(PlanTier);
const COUPON_CODE_TAKEN = 'COUPON_CODE_TAKEN';

export function CouponCreateForm(): ReactElement {
  const toast = useToast();
  const create = useCreateCoupon();
  const [code, setCode] = useState('');
  const [type, setType] = useState<string>(PromotionType.PercentageDiscount);
  const [value, setValue] = useState('10');
  const [appliesToTier, setAppliesToTier] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [campaign, setCampaign] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  /** Set only from COUPON_CODE_TAKEN — the field-level channel, cleared on every edit. */
  const [codeError, setCodeError] = useState<string | null>(null);

  const numericValue = Number(value);
  const valueValid = Number.isInteger(numericValue) && numericValue >= 0;
  const canSubmit = code.trim().length > 0 && valueValid && !create.isPending;

  const submit = (): void => {
    const payload: CreateCouponPayload = {
      code: code.trim(),
      type: type as PromotionType,
      value: numericValue,
      ...(appliesToTier === '' ? {} : { appliesToTier: appliesToTier as PlanTier }),
      ...(maxRedemptions === '' ? {} : { maxRedemptions: Number(maxRedemptions) }),
      ...(campaign.trim() === '' ? {} : { campaign: campaign.trim() }),
      ...(expiresAt === '' ? {} : { expiresAt: new Date(expiresAt).toISOString() }),
    };
    setCodeError(null);
    create.mutate(payload, {
      onSuccess: (coupon) => {
        toast.success(`Coupon ${coupon.code} created.`);
        setCode('');
        setCampaign('');
        setExpiresAt('');
        setMaxRedemptions('');
      },
      onError: (error) => {
        // The one error that belongs at the field. Everything else is a toast, because nothing on
        // this form would tell the operator what to change.
        if (isApiError(error) && error.code === COUPON_CODE_TAKEN) {
          setCodeError('That code already exists. Choose a different one.');
          return;
        }
        toast.error(getErrorMessage(error));
      },
    });
  };

  return (
    <QCard padding="md" className="flex flex-col gap-4">
      <QSectionHeader
        title="Create a coupon"
        description="Codes are normalised server-side, so case and surrounding spaces do not matter."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="coupon-code" className="text-sm font-medium text-ink">
            Code
          </label>
          <input
            id="coupon-code"
            type="text"
            maxLength={COUPON_CODE_MAX}
            value={code}
            aria-invalid={codeError !== null}
            aria-describedby={codeError === null ? undefined : 'coupon-code-error'}
            onChange={(event) => {
              setCode(event.target.value);
              // Clear on edit: a stale "already exists" beside a code they have since changed is
              // worse than no error at all.
              setCodeError(null);
            }}
            className="h-9 w-full max-w-sm rounded-md border border-line bg-surface px-3 text-sm text-ink"
          />
          {codeError === null ? null : (
            <span id="coupon-code-error" role="alert" className="text-xs text-danger">
              {codeError}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="coupon-type" className="text-sm font-medium text-ink">
            Type
          </label>
          <select
            id="coupon-type"
            value={type}
            onChange={(event) => {
              setType(event.target.value);
            }}
            className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
          >
            {TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="coupon-value" className="text-sm font-medium text-ink">
            Value
          </label>
          <input
            id="coupon-value"
            type="number"
            min={0}
            value={value}
            aria-invalid={!valueValid}
            aria-describedby="coupon-value-hint"
            onChange={(event) => {
              setValue(event.target.value);
            }}
            className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-ink"
          />
          <span id="coupon-value-hint" className="text-xs text-ink-muted">
            {couponValueHint(type)}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="coupon-tier" className="text-sm font-medium text-ink">
            Applies to tier <span className="text-ink-muted">(optional)</span>
          </label>
          <select
            id="coupon-tier"
            value={appliesToTier}
            onChange={(event) => {
              setAppliesToTier(event.target.value);
            }}
            className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
          >
            <option value="">Any tier</option>
            {TIERS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {/* Write-only over this surface — the coupon response omits it, so the list cannot show it. */}
          <span className="text-xs text-ink-muted">
            Stored but not returned by the coupon list, so it will not appear in the table below.
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="coupon-max" className="text-sm font-medium text-ink">
            Max redemptions <span className="text-ink-muted">(optional)</span>
          </label>
          <input
            id="coupon-max"
            type="number"
            min={0}
            value={maxRedemptions}
            onChange={(event) => {
              setMaxRedemptions(event.target.value);
            }}
            className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-ink"
          />
          <span className="text-xs text-ink-muted">Leave empty for unlimited redemptions.</span>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="coupon-campaign" className="text-sm font-medium text-ink">
            Campaign <span className="text-ink-muted">(optional)</span>
          </label>
          <input
            id="coupon-campaign"
            type="text"
            maxLength={120}
            value={campaign}
            onChange={(event) => {
              setCampaign(event.target.value);
            }}
            className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-ink"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="coupon-expires" className="text-sm font-medium text-ink">
            Expires at <span className="text-ink-muted">(optional)</span>
          </label>
          <input
            id="coupon-expires"
            type="date"
            value={expiresAt}
            onChange={(event) => {
              setExpiresAt(event.target.value);
            }}
            className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
          />
        </div>
      </div>

      <div>
        <QButton
          variant="primary"
          disabled={!canSubmit}
          loading={create.isPending}
          onClick={submit}
        >
          Create coupon
        </QButton>
      </div>
    </QCard>
  );
}
