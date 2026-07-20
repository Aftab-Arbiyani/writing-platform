import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';
import type { PremiumFeature, QuotaWindow } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';

/** The monetization platform is globally disabled (`feature.payments.enabled` off). */
export class MonetizationDisabledException extends AppException {
  constructor() {
    super(
      ERROR_CODES.MONETIZATION_DISABLED,
      'Monetization is not currently available.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/** No subscription for this user (missing or foreign — owner-scoped). */
export class SubscriptionNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.SUBSCRIPTION_NOT_FOUND, 'No subscription found.', HttpStatus.NOT_FOUND);
  }
}

/** The user already has an active subscription. */
export class SubscriptionAlreadyActiveException extends AppException {
  constructor() {
    super(
      ERROR_CODES.SUBSCRIPTION_ALREADY_ACTIVE,
      'You already have an active subscription.',
      HttpStatus.CONFLICT,
    );
  }
}

/** Illegal subscription lifecycle transition. */
export class SubscriptionInvalidTransitionException extends AppException {
  constructor(message = 'That subscription change is not allowed right now.') {
    super(ERROR_CODES.SUBSCRIPTION_INVALID_TRANSITION, message, HttpStatus.CONFLICT);
  }
}

/** Referenced a plan tier not present in the pricing config. */
export class PlanNotFoundException extends AppException {
  constructor(tier: string) {
    super(ERROR_CODES.PLAN_NOT_FOUND, `Unknown plan "${tier}".`, HttpStatus.NOT_FOUND);
  }
}

/** The requested plan change is a no-op. */
export class PlanChangeNoopException extends AppException {
  constructor() {
    super(
      ERROR_CODES.PLAN_CHANGE_NOOP,
      'You are already on that plan and interval.',
      HttpStatus.CONFLICT,
    );
  }
}

/** The user is not eligible for a trial (already used one). */
export class TrialNotEligibleException extends AppException {
  constructor() {
    super(
      ERROR_CODES.TRIAL_NOT_ELIGIBLE,
      'You have already used your free trial.',
      HttpStatus.CONFLICT,
    );
  }
}

/** The caller lacks entitlement to a premium feature (payment required). */
export class EntitlementDeniedException extends AppException {
  constructor(feature: PremiumFeature, reason: string) {
    super(
      ERROR_CODES.ENTITLEMENT_DENIED,
      `This feature requires an upgrade (${feature}).`,
      HttpStatus.PAYMENT_REQUIRED,
      [{ feature, reason }],
    );
  }
}

/** No such entitlement override. */
export class EntitlementOverrideNotFoundException extends AppException {
  constructor() {
    super(
      ERROR_CODES.ENTITLEMENT_OVERRIDE_NOT_FOUND,
      'No such entitlement override.',
      HttpStatus.NOT_FOUND,
    );
  }
}

/** A per-user AI usage/credit quota was hit. */
export class QuotaExceededException extends AppException {
  constructor(window: QuotaWindow, feature?: PremiumFeature) {
    super(
      ERROR_CODES.QUOTA_EXCEEDED,
      `You have reached your ${window} AI usage limit.`,
      HttpStatus.TOO_MANY_REQUESTS,
      feature !== undefined ? [{ window, feature }] : [{ window }],
    );
  }
}

/** The user has insufficient AI credits. */
export class InsufficientCreditsException extends AppException {
  constructor(required: number, available: number) {
    super(
      ERROR_CODES.INSUFFICIENT_CREDITS,
      'You do not have enough AI credits.',
      HttpStatus.PAYMENT_REQUIRED,
      [{ required, available }],
    );
  }
}

/** A payment attempt failed. */
export class PaymentFailedException extends AppException {
  constructor(reason?: string) {
    super(
      ERROR_CODES.PAYMENT_FAILED,
      'The payment could not be completed.',
      HttpStatus.PAYMENT_REQUIRED,
      reason !== undefined ? [{ reason }] : [],
    );
  }
}

/** No such payment for this user. */
export class PaymentNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.PAYMENT_NOT_FOUND, 'No such payment.', HttpStatus.NOT_FOUND);
  }
}

/** No such invoice for this user. */
export class InvoiceNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.INVOICE_NOT_FOUND, 'No such invoice.', HttpStatus.NOT_FOUND);
  }
}

/** The selected payment provider is not configured (no credentials). */
export class PaymentProviderNotConfiguredException extends AppException {
  constructor(provider: string) {
    super(
      ERROR_CODES.PAYMENT_PROVIDER_NOT_CONFIGURED,
      `Payment provider "${provider}" is not configured.`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/** The upstream payment provider errored. */
export class PaymentProviderErrorException extends AppException {
  constructor(message = 'The payment provider returned an error.') {
    super(ERROR_CODES.PAYMENT_PROVIDER_ERROR, message, HttpStatus.BAD_GATEWAY);
  }
}

/** A webhook failed signature/replay verification. */
export class WebhookSignatureInvalidException extends AppException {
  constructor() {
    super(
      ERROR_CODES.WEBHOOK_SIGNATURE_INVALID,
      'Webhook signature verification failed.',
      HttpStatus.BAD_REQUEST,
    );
  }
}

/** Store receipt / purchase-token validation failed. */
export class ReceiptValidationFailedException extends AppException {
  constructor(message = 'Receipt validation failed.') {
    super(ERROR_CODES.RECEIPT_VALIDATION_FAILED, message, HttpStatus.BAD_REQUEST);
  }
}

/** No such coupon / not currently redeemable. */
export class CouponNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.COUPON_NOT_FOUND, 'That code is not valid.', HttpStatus.NOT_FOUND);
  }
}

/** The coupon is expired / used up / not applicable. */
export class CouponNotRedeemableException extends AppException {
  constructor(message = 'That code cannot be used right now.') {
    super(ERROR_CODES.COUPON_NOT_REDEEMABLE, message, HttpStatus.CONFLICT);
  }
}

/** The caller has already redeemed this coupon the maximum number of times. */
export class CouponAlreadyRedeemedException extends AppException {
  constructor() {
    super(
      ERROR_CODES.COUPON_ALREADY_REDEEMED,
      'You have already used this code.',
      HttpStatus.CONFLICT,
    );
  }
}

/** Creating a coupon whose code already exists. */
export class CouponCodeTakenException extends AppException {
  constructor(code: string) {
    super(ERROR_CODES.COUPON_CODE_TAKEN, `Coupon "${code}" already exists.`, HttpStatus.CONFLICT);
  }
}

/** A restore/verification found nothing to restore. */
export class PurchaseNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.PURCHASE_NOT_FOUND, 'No purchases found to restore.', HttpStatus.NOT_FOUND);
  }
}
