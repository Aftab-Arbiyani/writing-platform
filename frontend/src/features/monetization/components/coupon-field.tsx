import { COUPON_CODE_MAX, normalizeCouponCode } from '@qalam/shared';
import { QButton, QInput } from '@qalam/ui';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { messageFor } from '@/lib/error-messages';
import { ApiError } from '@/lib/api-client';

import { useValidateCoupon } from '../hooks/use-plans';
import { formatMoney } from '../lib/monetization-format';
import type { BillingInterval, PlanTier } from '../types/monetization.types';

export interface CouponFieldProps {
  /** The plan being priced, so the server can compute a real discounted amount. */
  tier: PlanTier | undefined;
  interval: BillingInterval;
  currency: string;
  /** Bubbles the accepted code up so checkout can send it. `null` clears it. */
  onApplied: (code: string | null) => void;
}

/**
 * Coupon entry with a server-side preview (AF5, W4).
 *
 * **New on the web — mobile has no coupon UI at all.** Its repository exposes `validateCoupon` and no
 * screen calls it, and its plan screen passes no `couponCode` to checkout, so a mobile subscriber
 * cannot use a promotion (docs/48 §3.7, M5-2). This is the first working version of the surface, so it
 * was built from the DTO rather than ported.
 *
 * **Validation is a preview, never a promise.** The code is redeemed server-side during checkout, at
 * which point it can still fail — someone else may take the last redemption between the preview and
 * the purchase. So an accepted code is passed to checkout and checkout's own result is what the reader
 * is told; this only saves them from typing a code that was never going to work.
 *
 * `valid: false` is a normal answer, not an error: the endpoint catches both coupon exceptions and
 * resolves with a false flag (verified live), so `onError` here only ever means transport or rate
 * limiting.
 */
export function CouponField({
  tier,
  interval,
  currency,
  onApplied,
}: CouponFieldProps): ReactElement {
  const [code, setCode] = useState('');
  const validate = useValidateCoupon();

  const normalized = normalizeCouponCode(code);
  const result = validate.data;

  const submit = (): void => {
    if (normalized === '') return;
    validate.mutate(
      { code: normalized, tier, interval },
      {
        onSuccess: (preview) => {
          onApplied(preview.valid ? preview.code : null);
        },
        onError: () => {
          onApplied(null);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <QInput
            label="Promo code"
            value={code}
            maxLength={COUPON_CODE_MAX}
            autoComplete="off"
            // Codes are upper-case on the wire (`normalizeCouponCode`); showing them that way as the
            // reader types means the field agrees with the code on their voucher.
            onChange={(event) => {
              setCode(event.target.value.toUpperCase());
              onApplied(null);
              validate.reset();
            }}
            onPressEnter={submit}
          />
        </div>
        <QButton
          onClick={submit}
          loading={validate.isPending}
          disabled={validate.isPending || normalized === ''}
        >
          Apply
        </QButton>
      </div>

      {validate.isError ? (
        <p role="status" className="text-danger text-sm">
          {messageFor(validate.error instanceof ApiError ? validate.error.code : undefined)}
        </p>
      ) : null}

      {result ? (
        <p
          role="status"
          className={
            result.valid
              ? 'text-success flex items-center gap-1.5 text-sm'
              : 'text-ink-secondary flex items-center gap-1.5 text-sm'
          }
        >
          {result.valid ? (
            <CheckCircle2 size={14} aria-hidden />
          ) : (
            <XCircle size={14} aria-hidden />
          )}
          {result.valid
            ? // `discountedAmount` is only computed when the request carried both a tier and an
              // interval; without one the server prices from 0 and answers null, so the code is
              // confirmed without a figure rather than shown as a zero discount.
              result.discountedAmount === null
              ? result.description || 'Code applied.'
              : `${result.description || 'Code applied'} — ${formatMoney(result.discountedAmount, currency)} after discount`
            : 'That code isn’t valid or has expired.'}
        </p>
      ) : null}
    </div>
  );
}
