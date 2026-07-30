import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES, PolicyEffect, type PolicyDecision } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';

/**
 * Thrown when {@link PolicyEngineService.assert} rejects an action. The concrete
 * HTTP status is chosen from the decision's effect so the client renders the
 * right restricted-state screen; the machine code stays `POLICY_DENIED` (or
 * `POLICY_REQUIRES_REVIEW`) and the matched rule travels in `details`.
 */
export class PolicyDeniedException extends AppException {
  constructor(decision: PolicyDecision) {
    super(
      decision.effect === PolicyEffect.RequiresReview
        ? ERROR_CODES.POLICY_REQUIRES_REVIEW
        : ERROR_CODES.POLICY_DENIED,
      messageFor(decision),
      statusFor(decision.effect),
      [
        {
          effect: decision.effect,
          rule: decision.matchedRule,
          obligations: decision.obligations,
        },
      ],
    );
  }
}

function messageFor(decision: PolicyDecision): string {
  return decision.reason.length > 0 ? decision.reason : 'This action is not permitted.';
}

/** Maps a (blocking) policy effect to the HTTP status the client expects. */
function statusFor(effect: PolicyEffect): HttpStatus {
  switch (effect) {
    case PolicyEffect.RequiresReview:
      return HttpStatus.CONFLICT;
    case PolicyEffect.Suspended:
    case PolicyEffect.Blocked:
    case PolicyEffect.Muted:
    case PolicyEffect.ReadOnly:
    case PolicyEffect.TemporaryRestriction:
    case PolicyEffect.Deny:
    default:
      return HttpStatus.FORBIDDEN;
  }
}
