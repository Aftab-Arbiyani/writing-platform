/**
 * The parsed Craft Coach report (W2/AF2) — the client's ONE parser for every coach tool's
 * structured output.
 *
 * **Parsing is deliberately defensive.** The coach prompts instruct plain JSON rather than
 * relying on a provider's JSON mode, so a response can arrive wrapped in ``` fences or with a
 * sentence of preamble. `parseCoachReport` recovers the outermost object and returns `null` only
 * when nothing usable is there — at which point the UI shows the raw text instead of an error.
 * A model that ignores its output contract must degrade to "here is what it said", never to a
 * broken panel.
 */

export interface CoachSection {
  title: string;
  detail: string;
}

export interface CoachReport {
  /** Overall craft rating for this review, 0–100 (clamped). */
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  recommendations: string[];
  sections: CoachSection[];
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item !== '');
}

function toScore(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

function toSections(value: unknown): CoachSection[] {
  if (!Array.isArray(value)) return [];
  const out: CoachSection[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    const title = toText(record.title);
    const detail = toText(record.detail);
    if (title === '' && detail === '') continue;
    out.push({ title: title === '' ? 'Note' : title, detail });
  }
  return out;
}

/** Find the outermost `{ … }`, discarding code fences or prose around it. */
function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return raw.slice(start, end + 1);
}

function isEmptyReport(report: CoachReport): boolean {
  return (
    report.summary === '' &&
    report.strengths.length === 0 &&
    report.weaknesses.length === 0 &&
    report.suggestions.length === 0 &&
    report.recommendations.length === 0 &&
    report.sections.length === 0
  );
}

export function parseCoachReport(raw: string): CoachReport | null {
  const json = extractJsonObject(raw);
  if (json === null) return null;

  let decoded: unknown;
  try {
    decoded = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) return null;

  const record = decoded as Record<string, unknown>;
  const report: CoachReport = {
    score: toScore(record.score),
    summary: toText(record.summary),
    strengths: toTextList(record.strengths),
    weaknesses: toTextList(record.weaknesses),
    suggestions: toTextList(record.suggestions),
    recommendations: toTextList(record.recommendations),
    sections: toSections(record.sections),
  };

  // A shape that parsed but carries nothing is not a report — fall back to the raw text.
  return isEmptyReport(report) ? null : report;
}
