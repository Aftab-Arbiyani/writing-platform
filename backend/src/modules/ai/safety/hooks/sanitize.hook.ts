import { Injectable } from '@nestjs/common';
import { AiSafetyStage, AiSafetyVerdict } from '@qalam/shared';

import type { SafetyHook, SafetyInput, SafetyResult } from '../safety.types';

// Control chars except tab (\x09), newline (\x0A), carriage return (\x0D).
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Default input-sanitization hook (AF1): strips NUL/control characters that
 * could corrupt a provider request or downstream logs. Content-neutral — it does
 * not judge meaning (that is a future moderation hook's job).
 */
@Injectable()
export class SanitizeHook implements SafetyHook {
  readonly stage = AiSafetyStage.InputSanitization;

  check(input: SafetyInput): SafetyResult {
    const sanitizedText = input.text.replace(CONTROL_CHARS, '');
    return { verdict: AiSafetyVerdict.Allow, sanitizedText };
  }
}
