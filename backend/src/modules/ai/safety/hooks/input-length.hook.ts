import { Injectable } from '@nestjs/common';
import { AI_MESSAGE_MAX_LENGTH, AiSafetyStage, AiSafetyVerdict } from '@qalam/shared';

import type { SafetyHook, SafetyInput, SafetyResult } from '../safety.types';

/**
 * Default input-validation hook (AF1): rejects input longer than
 * `AI_MESSAGE_MAX_LENGTH` (defence-in-depth beyond DTO validation). Not a
 * moderation policy — purely a size guard.
 */
@Injectable()
export class InputLengthHook implements SafetyHook {
  readonly stage = AiSafetyStage.InputValidation;

  check(input: SafetyInput): SafetyResult {
    if (input.text.length > AI_MESSAGE_MAX_LENGTH) {
      return { verdict: AiSafetyVerdict.Block, reason: 'input exceeds the maximum length' };
    }
    return { verdict: AiSafetyVerdict.Allow };
  }
}
