import type { AiFeature, AiSafetyStage, AiSafetyVerdict } from '@qalam/shared';

/**
 * Safety pipeline contracts (AF1). AF1 ships the HOOK ARCHITECTURE and a couple
 * of permissive default hooks (length guard, sanitizer) — it deliberately
 * implements NO moderation/abuse POLICY. A future moderation feature registers
 * real hooks under {@link AI_SAFETY_HOOKS} for the `moderation`/`abuse_detection`
 * stages; nothing else changes.
 */

/** Who/what a hook is evaluating. */
export interface SafetyContext {
  userId: string;
  feature: AiFeature;
  stage: AiSafetyStage;
}

/** The text a hook inspects. */
export interface SafetyInput {
  text: string;
}

/** A hook's decision. `sanitizedText` (input stages) replaces the running text. */
export interface SafetyResult {
  verdict: AiSafetyVerdict;
  reason?: string;
  sanitizedText?: string;
}

/** A pluggable safety hook bound to one stage. */
export interface SafetyHook {
  readonly stage: AiSafetyStage;
  check(input: SafetyInput, context: SafetyContext): Promise<SafetyResult> | SafetyResult;
}

/** Multi-hook DI token — every safety hook registers under it. */
export const AI_SAFETY_HOOKS = Symbol('AI_SAFETY_HOOKS');
