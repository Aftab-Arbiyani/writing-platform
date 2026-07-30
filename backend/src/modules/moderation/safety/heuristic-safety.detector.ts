import { Injectable } from '@nestjs/common';
import { ReportReason, ReportSeverity } from '@qalam/shared';

import type { SafetyDetector, SafetyInput, SafetySignal } from './safety.types';

const URL_RE = /https?:\/\/\S+/gi;
/** A deliberately small, illustrative abuse lexicon (real deployments load a list). */
const ABUSE_TERMS = ['idiot', 'scum', 'trash', 'kill yourself', 'kys'];

/**
 * Fast, dependency-free spam/abuse heuristics — the always-on first line of
 * automated moderation. Intentionally conservative (favours recall over
 * precision) since a signal only RAISES a report for human review, never
 * auto-actions on its own.
 */
@Injectable()
export class HeuristicSafetyDetector implements SafetyDetector {
  readonly name = 'heuristic';

  detect(input: SafetyInput): SafetySignal[] {
    const text = input.text ?? '';
    const signals: SafetySignal[] = [];

    const linkCount = (text.match(URL_RE) ?? []).length;
    if (linkCount >= 3) {
      signals.push({
        detector: this.name,
        reason: ReportReason.Spam,
        confidence: Math.min(0.5 + linkCount * 0.1, 0.95),
        severity: ReportSeverity.Medium,
        explanation: `Contains ${linkCount} links.`,
      });
    }

    const letters = text.replace(/[^a-z]/gi, '');
    if (letters.length >= 20) {
      const upperRatio = (letters.match(/[A-Z]/g) ?? []).length / letters.length;
      if (upperRatio >= 0.7) {
        signals.push({
          detector: this.name,
          reason: ReportReason.Spam,
          confidence: 0.6,
          severity: ReportSeverity.Low,
          explanation: 'Predominantly upper-case (shouting/spam pattern).',
        });
      }
    }

    if (/(.)\1{9,}/.test(text)) {
      signals.push({
        detector: this.name,
        reason: ReportReason.Spam,
        confidence: 0.65,
        severity: ReportSeverity.Low,
        explanation: 'Long run of a repeated character.',
      });
    }

    const lower = text.toLowerCase();
    const hit = ABUSE_TERMS.find((term) => lower.includes(term));
    if (hit !== undefined) {
      const severe = hit === 'kill yourself' || hit === 'kys';
      signals.push({
        detector: this.name,
        reason: severe ? ReportReason.SelfHarm : ReportReason.Harassment,
        confidence: severe ? 0.9 : 0.7,
        severity: severe ? ReportSeverity.Critical : ReportSeverity.High,
        explanation: `Matched abusive term "${hit}".`,
      });
    }

    return signals;
  }
}
