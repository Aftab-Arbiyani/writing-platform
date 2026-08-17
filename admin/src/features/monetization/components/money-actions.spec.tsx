import { PromotionType, Role } from '@qalam/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

import { CouponCreateForm } from './coupon-create-form';
import { CreditAdjustForm } from './credit-adjust-form';
import { RefundForm } from './refund-form';
import type { AdminCoupon, AdminPayment } from '../types/monetization.types';

vi.mock('../api/monetization.api');

const { monetizationApi } = await import('../api/monetization.api');
const createCoupon = vi.mocked(monetizationApi.createCoupon);
const adjustCredits = vi.mocked(monetizationApi.adjustCredits);
const refundPayment = vi.mocked(monetizationApi.refundPayment);
const getUserCredits = vi.mocked(monetizationApi.getUserCredits);
const getUserPayments = vi.mocked(monetizationApi.getUserPayments);

/** A wallet holding `balance`, or the never-had-one state when `balance` is null. */
function wallet(balance: number | null) {
  return {
    userId: 'u-1',
    credits:
      balance === null
        ? null
        : {
            balance,
            lifetimeGranted: balance,
            lifetimeConsumed: 0,
            creditsPerUsd: 1000,
            updatedAt: '2026-08-17T10:00:00.000Z',
          },
  };
}

function apiError(status: number, code: string): ApiError {
  return new ApiError(status, { code, message: 'x', details: [], requestId: 'req-1' });
}

const COUPON: AdminCoupon = {
  id: 'c-1',
  code: 'SPRING20',
  type: PromotionType.PercentageDiscount,
  value: 20,
  active: true,
  redemptions: 0,
  maxRedemptions: 0,
  perUserLimit: 1,
  appliesToTier: null,
  campaign: null,
  description: null,
  expiresAt: null,
  createdAt: '2026-08-17T10:00:00.000Z',
};

const REFUND: AdminPayment = {
  id: 'p-1',
  provider: 'stripe',
  method: 'card',
  status: 'refunded',
  amount: -2000,
  currency: 'usd',
  description: 'Refund',
  createdAt: '2026-08-17T10:00:00.000Z',
};

function dialogButton(name: string): HTMLElement {
  return within(screen.getByRole('dialog')).getByRole('button', { name });
}

beforeEach(() => {
  vi.clearAllMocks();
  // The two per-account reads B8 added. Both forms look the account up before acting, so every
  // test needs an answer for them; individual tests override with the state they are about.
  getUserCredits.mockResolvedValue(wallet(1200));
  getUserPayments.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  // Both per-account reads are gated on `billing.manage` via `enabled`, so a test without the grant
  // would watch a query that never fires and read as a UI bug. The gating is deliberate — a viewer
  // the router let through by role should not provoke a 403 — so the grant is established here.
  useAuthStore.setState({ status: 'authenticated', role: Role.Admin });
});

afterEach(() => useAuthStore.getState().clear());

describe('CouponCreateForm — COUPON_CODE_TAKEN is a field error, never a toast', () => {
  it('puts the message on the code input and marks it invalid', async () => {
    createCoupon.mockRejectedValue(apiError(409, 'COUPON_CODE_TAKEN'));
    renderWithProviders(<CouponCreateForm />);

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'SPRING20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create coupon' }));

    // The one error the operator can fix without leaving the form, so it belongs AT the field.
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('That code already exists. Choose a different one.');
    expect(screen.getByLabelText('Code')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Code')).toHaveAccessibleDescription(/already exists/);
  });

  it('clears the field error as soon as the operator edits the code', async () => {
    createCoupon.mockRejectedValue(apiError(409, 'COUPON_CODE_TAKEN'));
    renderWithProviders(<CouponCreateForm />);

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'SPRING20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create coupon' }));
    await screen.findByRole('alert');

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'SPRING21' } });

    // A stale "already exists" beside a code they have since changed is worse than no error.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toHaveAttribute('aria-invalid', 'false');
  });

  it('does NOT put an unrelated failure on the code field', async () => {
    createCoupon.mockRejectedValue(apiError(500, 'INTERNAL_ERROR'));
    renderWithProviders(<CouponCreateForm />);

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'SPRING20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create coupon' }));

    await waitFor(() => {
      expect(createCoupon).toHaveBeenCalled();
    });
    // Nothing on this form would tell the operator what to change, so it is a toast, not a field.
    expect(screen.getByLabelText('Code')).toHaveAttribute('aria-invalid', 'false');
  });

  it('changes the value hint with the promotion type', () => {
    renderWithProviders(<CouponCreateForm />);

    expect(screen.getByText(/20% off/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Type'), {
      target: { value: PromotionType.FixedDiscount },
    });
    expect(screen.getByText(/Minor currency units/)).toBeInTheDocument();
  });

  it('sends the coupon on success', async () => {
    createCoupon.mockResolvedValue(COUPON);
    renderWithProviders(<CouponCreateForm />);

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: ' spring20 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create coupon' }));

    await waitFor(() => {
      // Trimmed client-side; the server normalises case itself.
      expect(createCoupon).toHaveBeenCalledWith(expect.objectContaining({ code: 'spring20' }));
    });
  });
});

describe('CreditAdjustForm — a deduction confirms, a grant does not', () => {
  it('sends a grant without a confirmation', async () => {
    adjustCredits.mockResolvedValue({ userId: 'u-1', balance: 1250 });
    renderWithProviders(<CreditAdjustForm />);

    fireEvent.change(screen.getByLabelText('User ID'), { target: { value: 'u-1' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Grant credits' }));

    await waitFor(() => {
      expect(adjustCredits).toHaveBeenCalledWith({ userId: 'u-1', amount: 250 });
    });
  });

  it('holds a deduction behind a confirmation that states the resulting balance', async () => {
    // What A1's brief asked for and A1 could not build: the balance is read, so the confirmation
    // projects the result rather than describing a floor rule (B8, A1-3).
    renderWithProviders(<CreditAdjustForm />);

    fireEvent.change(screen.getByLabelText('User ID'), { target: { value: 'u-1' } });
    await screen.findByText(/granted 1,200/);
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '-500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Deduct credits' }));

    expect(adjustCredits).not.toHaveBeenCalled();
    expect(screen.getByText('Deduct 500 credits?')).toBeInTheDocument();
    expect(screen.getByText(/from 1,200 to 700 credits/i)).toBeInTheDocument();
  });

  it('says the clamp will bite when the deduction exceeds the balance', async () => {
    // DECISION 3: the zero clamp stays, so the honest projection is "emptied to 0, and only 200
    // actually removed" — not "-300", and not a silent success that took less than was typed.
    getUserCredits.mockResolvedValue(wallet(200));
    renderWithProviders(<CreditAdjustForm />);

    fireEvent.change(screen.getByLabelText('User ID'), { target: { value: 'u-1' } });
    await screen.findByText(/granted 200/);
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '-500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Deduct credits' }));

    expect(screen.getByText(/emptied to 0 rather than going negative/i)).toBeInTheDocument();
    expect(screen.getByText(/only 200 credits are actually removed/i)).toBeInTheDocument();
  });

  it('reports the server’s actual post-clamp balance, not a projection', async () => {
    // Deducting 500 from an account holding less lands on 0 — `CreditService.apply` clamps. The
    // screen states what the server returned, which is the only figure it can honestly show.
    adjustCredits.mockResolvedValue({ userId: 'u-1', balance: 0 });
    getUserCredits.mockResolvedValue(wallet(200));
    renderWithProviders(<CreditAdjustForm />);

    fireEvent.change(screen.getByLabelText('User ID'), { target: { value: 'u-1' } });
    await screen.findByText(/granted 200/);
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '-500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Deduct credits' }));
    fireEvent.click(dialogButton('Deduct'));

    // The projection said the account would be emptied; this is the server agreeing. The reported
    // figure is still the response's, never the client's arithmetic.
    expect(
      await screen.findByText("Deducted. The account's balance is now 0 credits."),
    ).toBeInTheDocument();
  });

  it('shows the account’s current balance once an ID is entered', async () => {
    renderWithProviders(<CreditAdjustForm />);

    // Nothing is fetched until there is an account to fetch — the read is per-user and there is no
    // "all wallets" route to fall back on.
    expect(getUserCredits).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('User ID'), { target: { value: 'u-1' } });

    expect(await screen.findByText('1,200')).toBeInTheDocument();
    expect(screen.getByText(/granted 1,200/)).toBeInTheDocument();
  });

  it('calls an account with no wallet a balance of zero, not an error', async () => {
    // `credits: null` means the account has never been granted or spent a credit. That is a
    // balance, and it is 0 — rendering it as a failure would be the W7c defect in miniature.
    getUserCredits.mockResolvedValue(wallet(null));
    renderWithProviders(<CreditAdjustForm />);

    fireEvent.change(screen.getByLabelText('User ID'), { target: { value: 'u-1' } });

    expect(await screen.findByText(/has no wallet yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('RefundForm — every refund confirms, and the four failures stay apart', () => {
  function fillAndSubmit(): void {
    fireEvent.change(screen.getByLabelText('Payment ID'), { target: { value: 'p-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Refund payment' }));
  }

  it('does not send until confirmed, and says a bare refund is IN FULL', () => {
    renderWithProviders(<RefundForm />);
    fillAndSubmit();

    expect(refundPayment).not.toHaveBeenCalled();
    expect(screen.getByText(/refunded IN FULL/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be reversed from this screen/)).toBeInTheDocument();
  });

  it('names a partial amount in the confirmation', () => {
    renderWithProviders(<RefundForm />);
    fireEvent.change(screen.getByLabelText('Payment ID'), { target: { value: 'p-1' } });
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Refund payment' }));

    expect(screen.getByText(/partial refund of 500/)).toBeInTheDocument();
  });

  it('reports a success with the refund’s magnitude, not its negative amount', async () => {
    refundPayment.mockResolvedValue(REFUND);
    renderWithProviders(<RefundForm />);
    fillAndSubmit();
    fireEvent.click(dialogButton('Send refund'));

    expect(await screen.findByRole('status')).toHaveTextContent('Refunded 2,000 USD.');
  });

  it('PAYMENT_NOT_FOUND blames the input and offers NO retry', async () => {
    refundPayment.mockRejectedValue(apiError(404, 'PAYMENT_NOT_FOUND'));
    renderWithProviders(<RefundForm />);
    fillAndSubmit();
    fireEvent.click(dialogButton('Send refund'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No payment with that ID');
    // No longer hedged with "or was never captured at a provider": that state has its own code
    // since B8, so this copy can finally mean only what it says (A1-1).
    expect(alert).not.toHaveTextContent(/never captured at a provider/i);
    expect(within(alert).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('PAYMENT_NOT_REFUNDABLE says the ID is RIGHT and offers no retry', async () => {
    // The state A1 had to fold into the 404. Opposite remedy: do not go looking for a better id.
    refundPayment.mockRejectedValue(apiError(409, 'PAYMENT_NOT_REFUNDABLE'));
    renderWithProviders(<RefundForm />);
    fillAndSubmit();
    fireEvent.click(dialogButton('Send refund'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('That payment cannot be refunded');
    expect(alert).toHaveTextContent(/the ID is correct/i);
    expect(within(alert).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('lists the account’s payments and fills the ID when one is picked', async () => {
    // A1-5's closure, end to end: the operator no longer needs an id from outside the app.
    getUserPayments.mockResolvedValue({
      items: [
        {
          id: 'p-42',
          provider: 'stripe',
          method: 'card',
          status: 'succeeded',
          amount: 1999,
          currency: 'usd',
          description: 'Plus, monthly',
          createdAt: '2026-08-10T10:00:00.000Z',
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
    renderWithProviders(<RefundForm />);

    fireEvent.change(screen.getByLabelText('User ID'), { target: { value: 'u-1' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Select' }));

    expect(screen.getByLabelText('Payment ID')).toHaveValue('p-42');
  });

  it('lists a refund row but refuses to select it', async () => {
    // A refund is its own negative payment row on the same account. Hiding it would make an
    // already-refunded charge look untouched; offering it would invite refunding a refund.
    getUserPayments.mockResolvedValue({
      items: [
        {
          id: 'p-43',
          provider: 'stripe',
          method: 'card',
          status: 'refunded',
          amount: -1999,
          currency: 'usd',
          description: 'Refund',
          createdAt: '2026-08-11T10:00:00.000Z',
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
    renderWithProviders(<RefundForm />);

    fireEvent.change(screen.getByLabelText('User ID'), { target: { value: 'u-1' } });

    expect(await screen.findByText('Already a refund')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
  });

  it('PAYMENT_PROVIDER_ERROR blames the provider and DOES offer a retry', async () => {
    refundPayment.mockRejectedValue(apiError(502, 'PAYMENT_PROVIDER_ERROR'));
    renderWithProviders(<RefundForm />);
    fillAndSubmit();
    fireEvent.click(dialogButton('Send refund'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The payment provider refused the refund');
    expect(alert).toHaveTextContent(/no money has moved/i);
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('never renders the two as the same wall', async () => {
    // The conflation rule. Same shape of failure, opposite next action.
    refundPayment.mockRejectedValue(apiError(404, 'PAYMENT_NOT_FOUND'));
    const first = renderWithProviders(<RefundForm />);
    fillAndSubmit();
    fireEvent.click(dialogButton('Send refund'));
    const notFound = (await screen.findByRole('alert')).textContent;
    first.unmount();

    refundPayment.mockRejectedValue(apiError(502, 'PAYMENT_PROVIDER_ERROR'));
    renderWithProviders(<RefundForm />);
    fillAndSubmit();
    fireEvent.click(dialogButton('Send refund'));
    const providerError = (await screen.findByRole('alert')).textContent;

    expect(notFound).not.toBe(providerError);
  });

  it('PAYMENT_PROVIDER_NOT_CONFIGURED gets its own copy and no retry', async () => {
    refundPayment.mockRejectedValue(apiError(503, 'PAYMENT_PROVIDER_NOT_CONFIGURED'));
    renderWithProviders(<RefundForm />);
    fillAndSubmit();
    fireEvent.click(dialogButton('Send refund'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('That provider is not configured here');
    expect(within(alert).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});
