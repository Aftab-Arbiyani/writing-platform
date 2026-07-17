import { Inject, Injectable, Optional } from '@nestjs/common';
import { AiSafetyStage, AiSafetyVerdict } from '@qalam/shared';
import type { AiFeature } from '@qalam/shared';

import { AiInputBlockedException, AiOutputBlockedException } from '../ai.exceptions';
import { AI_SAFETY_HOOKS } from './safety.types';
import type { SafetyHook } from './safety.types';

/**
 * Runs the safety pipeline (AF1). Groups registered hooks by stage and runs them
 * in order; a `block` verdict throws (`AI_INPUT_BLOCKED` / `AI_OUTPUT_BLOCKED`),
 * a sanitizing hook rewrites the running text. AF1 registers only permissive
 * defaults (length + sanitize); the abuse/moderation stages have no default hook
 * (⇒ permissive) — they are the seam a moderation feature fills. This is the one
 * safety choke point every AI feature passes through.
 */
@Injectable()
export class SafetyService {
  private readonly byStage = new Map<AiSafetyStage, SafetyHook[]>();

  constructor(@Optional() @Inject(AI_SAFETY_HOOKS) hooks: SafetyHook[] | null) {
    for (const hook of hooks ?? []) {
      const list = this.byStage.get(hook.stage) ?? [];
      list.push(hook);
      this.byStage.set(hook.stage, list);
    }
  }

  /** Validate + sanitize user input; returns the sanitized text or throws. */
  async checkInput(text: string, userId: string, feature: AiFeature): Promise<string> {
    const result = await this.runStages(
      [
        AiSafetyStage.InputValidation,
        AiSafetyStage.InputSanitization,
        AiSafetyStage.AbuseDetection,
      ],
      text,
      userId,
      feature,
    );
    if (result.blocked) {
      throw new AiInputBlockedException(result.reason);
    }
    return result.text;
  }

  /** Validate generated output; returns it (possibly rewritten) or throws. */
  async checkOutput(text: string, userId: string, feature: AiFeature): Promise<string> {
    const result = await this.runStages(
      [AiSafetyStage.OutputValidation, AiSafetyStage.Moderation],
      text,
      userId,
      feature,
    );
    if (result.blocked) {
      throw new AiOutputBlockedException(result.reason);
    }
    return result.text;
  }

  private async runStages(
    stages: AiSafetyStage[],
    text: string,
    userId: string,
    feature: AiFeature,
  ): Promise<{ text: string; blocked: boolean; reason: string }> {
    let current = text;
    for (const stage of stages) {
      for (const hook of this.byStage.get(stage) ?? []) {
        const result = await hook.check({ text: current }, { userId, feature, stage });
        if (result.sanitizedText !== undefined) {
          current = result.sanitizedText;
        }
        if (result.verdict === AiSafetyVerdict.Block) {
          return {
            text: current,
            blocked: true,
            reason: result.reason ?? 'blocked by safety policy',
          };
        }
      }
    }
    return { text: current, blocked: false, reason: '' };
  }
}
