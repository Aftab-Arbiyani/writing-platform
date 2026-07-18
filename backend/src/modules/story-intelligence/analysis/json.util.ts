import type { StoryEvidenceRef } from '../story.types';

/**
 * Defensive JSON helpers for parsing model output (AF3). Analysis prompts instruct a
 * documented JSON schema (never plain text), but models occasionally wrap it in code
 * fences or stray prose — these recover the object and read fields tolerantly so a
 * slightly-off response degrades to a partial structured result rather than a crash.
 * Pure functions; no `any` (unknown + narrowing, docs 16 §1.1).
 */

/** Recover the outermost `{ … }` object from a model response, or null. */
export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  return isRecord(parsed) ? parsed : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

export function asStringOrNull(value: unknown): string | null {
  const s = asString(value);
  return s === '' ? null : s;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => asString(entry)).filter((entry) => entry !== '');
}

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** Read a 0–100 score and normalize to a 0–1 confidence. */
export function asConfidence(value: unknown): number {
  const n = asNumber(value, 0);
  const scaled = n > 1 ? n / 100 : n;
  return Math.min(1, Math.max(0, scaled));
}

/** Read a 0–100 score, clamped, kept on the 0–100 scale. */
export function asScore(value: unknown): number {
  return Math.min(100, Math.max(0, Math.round(asNumber(value, 0))));
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

/** Read an evidence array — tolerates `["quote"]` or `[{ chapterRef, quote }]`. */
export function asEvidence(value: unknown): StoryEvidenceRef[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: StoryEvidenceRef[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim() !== '') {
      out.push({ chapterRef: null, quote: entry.trim() });
    } else if (isRecord(entry)) {
      const quote = asString(entry.quote ?? entry.text);
      if (quote !== '') {
        out.push({ chapterRef: asStringOrNull(entry.chapterRef ?? entry.chapter), quote });
      }
    }
  }
  return out;
}
