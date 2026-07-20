import { Injectable } from '@nestjs/common';

import type { SafetyDetector, SafetyInput, SafetySignal } from './safety.types';

/**
 * AI-assisted moderation detector — ARCHITECTURE-READY SEAM (AF6). When the AI
 * platform (AF1) exposes a moderation capability, wire it here: inject the AI
 * orchestration service (optionally, via a DI token to avoid a module cycle),
 * send the text to a moderation prompt, and map the structured result to
 * {@link SafetySignal}s. Until then it returns no signals, so the pipeline runs
 * on heuristics alone with zero behavioural change.
 *
 * It is deliberately a first-class detector (not a special case) so enabling AI
 * moderation is a one-line registration, not a service rewrite.
 */
@Injectable()
export class AiSafetyDetector implements SafetyDetector {
  readonly name = 'ai-assisted';

  detect(_input: SafetyInput): SafetySignal[] {
    // AF6 seam: call the AI moderation capability here once AF1 exposes it.
    // e.g. `const r = await this.ai.moderate(_input.text); return mapToSignals(r);`
    return [];
  }
}
