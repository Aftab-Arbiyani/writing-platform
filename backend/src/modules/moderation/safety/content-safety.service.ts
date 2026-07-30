import { Inject, Injectable, Logger } from '@nestjs/common';
import { ReportSeverity } from '@qalam/shared';

import {
  SAFETY_DETECTORS,
  SAFETY_FLAG_THRESHOLD,
  type SafetyDetector,
  type SafetyInput,
  type SafetySignal,
  type SafetyVerdict,
} from './safety.types';

const SEVERITY_RANK: Record<ReportSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * Runs the registered automated safety detectors over a piece of content and
 * aggregates their signals into one verdict. Reusable across moderation (report
 * triage), collaboration (comments), and publishing. Never auto-actions — it
 * only recommends a severity so a human moderator (or the report queue) can
 * prioritise. Detector failures are isolated so one bad rule can't blind the rest.
 */
@Injectable()
export class ContentSafetyService {
  private readonly logger = new Logger(ContentSafetyService.name);

  constructor(@Inject(SAFETY_DETECTORS) private readonly detectors: readonly SafetyDetector[]) {}

  async evaluate(input: SafetyInput): Promise<SafetyVerdict> {
    const signals: SafetySignal[] = [];
    for (const detector of this.detectors) {
      try {
        signals.push(...(await detector.detect(input)));
      } catch (error) {
        this.logger.warn(`safety detector ${detector.name} failed: ${(error as Error).message}`);
      }
    }

    const score = signals.reduce((max, s) => Math.max(max, s.confidence), 0);
    const recommendedSeverity = this.worstSeverity(signals);
    return {
      flagged: score >= SAFETY_FLAG_THRESHOLD,
      score,
      signals,
      recommendedSeverity,
    };
  }

  private worstSeverity(signals: readonly SafetySignal[]): ReportSeverity | null {
    let worst: ReportSeverity | null = null;
    for (const signal of signals) {
      if (worst === null || SEVERITY_RANK[signal.severity] > SEVERITY_RANK[worst]) {
        worst = signal.severity;
      }
    }
    return worst;
  }
}
