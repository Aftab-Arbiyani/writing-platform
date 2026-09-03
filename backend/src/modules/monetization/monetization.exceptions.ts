import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES, QuotaWindow } from '@qalam/shared';
import type { PremiumFeature } from '@qalam/shared';

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

/**
 * A per-feature allowance was spent (D5).
 *
 * The message names the THING and the NUMBER — "You've used today's Polish (30 of 30)" —
 * because the budget this replaced could only say "your daily AI usage limit", which told a
 * writer neither what they had spent it on nor what to expect back. `details` carries the
 * structured facts so a client can render its own copy and a progress bar without parsing
 * the sentence.
 *
 * The code and 429 status are unchanged, so every remedy already wired to `QUOTA_EXCEEDED`
 * on both clients keeps routing.
 */
export class QuotaExceededException extends AppException {
  constructor(
    window: QuotaWindow,
    detail?: { limitKey: string; label: string; used: number; limit: number; resetsAt: string },
  ) {
    super(
      ERROR_CODES.QUOTA_EXCEEDED,
      detail === undefined
        ? `You have reached your ${window} usage limit.`
        : `You've used ${window === QuotaWindow.Daily ? "today's" : "this month's"} ` +
            `${detail.label} (${detail.used} of ${detail.limit}).`,
      HttpStatus.TOO_MANY_REQUESTS,
      detail !== undefined ? [{ window, ...detail }] : [{ window }],
    );
  }
}

/**
 * The author already holds as many pieces as their plan allows (B4, docs/45 §4.9).
 *
 * A separate code from {@link QuotaExceededException} on purpose. That one is a FLOW cap — tokens
 * or credits burned inside a window — and its honest remedy is "wait, it resets". This is a STOCK
 * cap on live pieces: nothing resets, ever, so the only two things that help are deleting a piece
 * and moving to a bigger plan. Conflating the two remedies is the W4 defect (docs/48 §3.6), and it
 * ends with a blocked author waiting for a reset that never arrives.
 *
 * 402 rather than 429 for the same reason: this is an upgrade conversation, not a rate limit.
 */
export class PieceLimitReachedException extends AppException {
  constructor(used: number, limit: number) {
    super(
      ERROR_CODES.PIECE_LIMIT_REACHED,
      `Your plan allows ${limit} pieces and you have ${used}.`,
      HttpStatus.PAYMENT_REQUIRED,
      [{ used, limit }],
    );
  }
}

/**
 * The story has no collaborator seat left on its OWNER's plan (B6, docs/45 §4.11).
 *
 * Thrown at the two doors that create a seat — inviting and adding a member directly — and read
 * against `getLimits(ownerId)`, never the actor's own plan: a co-author with a Pro subscription
 * inviting into a Free author's story is still spending the FREE author's seats.
 *
 * A separate code from {@link PieceLimitReachedException} even though both are 402 stock caps: B4
 * counts the author's own library and its remedy is "delete a piece", while this counts one story's
 * roster and its remedy is "remove a collaborator". It is also not `STORY_COLLABORATOR_LIMIT`, the
 * flat anti-abuse ceiling that no plan can raise, and not `QUOTA_EXCEEDED`, whose "wait for the
 * reset" remedy would never arrive (the W4 defect, docs/48 §3.6).
 */
export class CollaboratorLimitReachedException extends AppException {
  constructor(used: number, limit: number) {
    super(
      ERROR_CODES.COLLABORATOR_LIMIT_REACHED,
      `Your plan allows ${limit} collaborator${limit === 1 ? '' : 's'} per story and this story has ${used}.`,
      HttpStatus.PAYMENT_REQUIRED,
      [{ used, limit }],
    );
  }
}

/**
 * The invitee cannot accept: the owner's plan has no seat left for them (B6, docs/45 §4.11).
 *
 * The same fact as {@link CollaboratorLimitReachedException} told to the other person, which is why
 * it is a different code, a different status, and different words. The invite was valid when it was
 * sent; the owner has since downgraded or filled the story. **No upsell and no `used`/`limit` in the
 * message** — the invitee cannot buy a seat on someone else's plan, and quoting a stranger's plan
 * size at them both blames the wrong person and leaks what the owner pays.
 */
export class CollaboratorSeatsUnavailableException extends AppException {
  constructor() {
    super(
      ERROR_CODES.COLLABORATOR_SEATS_UNAVAILABLE,
      'This story has no collaborator seats left. Ask the story owner to free one before accepting.',
      HttpStatus.CONFLICT,
    );
  }
}

/**
 * The requested story version is older than the OWNER's plan shows (B7, docs/45 §4.12).
 *
 * Thrown at the two doors that reach a single version by id — `GET /snapshots/:id` and
 * `POST /stories/:id/snapshots/:snapshotId/revert` — and never at capture. Clamping only the list
 * would leave revert an open door for anyone who kept an old id, which is the unenforced-gate shape
 * docs/48 §5.2 catalogues; blocking capture instead would make **accepting a suggestion fail** for a
 * free author, because that path takes a `pre_edit` snapshot inside the settling transaction.
 *
 * ## Why the copy is an offer and not an error
 *
 * The version still exists — B7 hides, it never deletes — so upgrading brings it back retroactively
 * and that is the only remedy there is. `QUOTA_EXCEEDED`'s "wait, it resets" is the W4 defect
 * (docs/48 §3.6) and would never come true here. `PieceLimitReachedException` and
 * `CollaboratorLimitReachedException` are both refusals to CREATE, answered by deleting a piece or
 * removing a collaborator; deleting things is exactly what does NOT make an old version readable,
 * so this needs its own code and its own sentence.
 *
 * 402 rather than 404: the row is there and the plan is what stands between the author and it.
 */
export class SnapshotHistoryLimitedException extends AppException {
  constructor(version: number, limit: number) {
    super(
      ERROR_CODES.SNAPSHOT_HISTORY_LIMITED,
      `Your plan shows the ${limit} most recent version${limit === 1 ? '' : 's'} of a story. ` +
        `Version ${version} is still saved — upgrade to open it.`,
      HttpStatus.PAYMENT_REQUIRED,
      [{ version, limit }],
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

/**
 * The payment exists but has no provider-side charge to reverse.
 *
 * 409, not 404: the row is there and the operator's id is correct — the CONFLICT is between the
 * payment's state and the action asked of it, exactly like `COUPON_NOT_REDEEMABLE` (a coupon that
 * exists but cannot be used right now) two dozen lines below.
 */
export class PaymentNotRefundableException extends AppException {
  constructor() {
    super(
      ERROR_CODES.PAYMENT_NOT_REFUNDABLE,
      'That payment was never captured at a provider, so there is nothing to refund.',
      HttpStatus.CONFLICT,
    );
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
