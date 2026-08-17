import { PromotionType } from '@qalam/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
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
  campaign: null,
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
});

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

  it('holds a deduction behind a confirmation that states the zero floor', () => {
    renderWithProviders(<CreditAdjustForm />);

    fireEvent.change(screen.getByLabelText('User ID'), { target: { value: 'u-1' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '-500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Deduct credits' }));

    expect(adjustCredits).not.toHaveBeenCalled();
    expect(screen.getByText('Deduct 500 credits?')).toBeInTheDocument();
    expect(screen.getByText(/will not go below zero/i)).toBeInTheDocument();
  });

  it('reports the server’s actual post-clamp balance, not a projection', async () => {
    // Deducting 500 from an account holding less lands on 0 — `CreditService.apply` clamps. The
    // screen states what the server returned, which is the only figure it can honestly show.
    adjustCredits.mockResolvedValue({ userId: 'u-1', balance: 0 });
    renderWithProviders(<CreditAdjustForm />);

    fireEvent.change(screen.getByLabelText('User ID'), { target: { value: 'u-1' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '-500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Deduct credits' }));
    fireEvent.click(dialogButton('Deduct'));

    expect(await screen.findByRole('status')).toHaveTextContent(
      "Deducted. The account's balance is now 0 credits.",
    );
  });

  it('says plainly that it cannot show the current balance', () => {
    renderWithProviders(<CreditAdjustForm />);

    // Better than a blank space where a balance should be: the operator learns it is a contract
    // limit rather than a loading failure.
    expect(screen.getByLabelText('Amount')).toHaveAccessibleDescription(
      /cannot show the current balance/i,
    );
  });
});

describe('RefundForm — every refund confirms, and the three failures stay apart', () => {
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
    expect(alert).toHaveTextContent('No refundable payment with that ID');
    expect(within(alert).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
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
