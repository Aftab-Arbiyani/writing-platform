import type { ReportReason, ReportSeverity } from '@qalam/shared';

/**
 * Automated content-safety vocabulary (AF6). A pluggable detector pipeline that
 * spam/abuse heuristics and (as a seam) AI-assisted moderation feed into. It is
 * REUSABLE: collaboration comments, publishing, and report triage all call the
 * same {@link ContentSafetyService}. Stateless — no tables, no migration.
 */

/** What a detector inspects. */
export interface SafetyInput {
  readonly text: string;
  readonly authorId?: string;
  readonly context?: Record<string, unknown>;
}

/** A single detector's finding, keyed to the existing report-reason catalogue. */
export interface SafetySignal {
  readonly detector: string;
  readonly reason: ReportReason;
  /** 0..1 — how confident the detector is. */
  readonly confidence: number;
  readonly severity: ReportSeverity;
  readonly explanation: string;
}

/** The aggregate verdict returned to callers. */
export interface SafetyVerdict {
  readonly flagged: boolean;
  /** Aggregate 0..1 risk score (max signal confidence). */
  readonly score: number;
  readonly signals: readonly SafetySignal[];
  readonly recommendedSeverity: ReportSeverity | null;
}

/**
 * One automated safety rule. Detectors are registered as a multi-provider array
 * so new rules (or an AI-assisted detector) drop in without touching the service
 * — "Automated Safety Rules" as an open, extensible set.
 */
export interface SafetyDetector {
  readonly name: string;
  detect(input: SafetyInput): Promise<SafetySignal[]> | SafetySignal[];
}

/** DI token for the ordered detector array. */
export const SAFETY_DETECTORS = Symbol('SAFETY_DETECTORS');

/** Confidence at/above which content is auto-flagged. */
export const SAFETY_FLAG_THRESHOLD = 0.6;
