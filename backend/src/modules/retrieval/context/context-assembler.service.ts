import { Injectable } from '@nestjs/common';

import type { AssembledContext, RankedCandidate, RetrievalEvidence } from '../retrieval.types';
import { estimateTokens, truncateToTokens } from '../retrieval.text.util';

const MAX_EVIDENCE = 12;
const MIN_FRAGMENT_TOKENS = 24;

/**
 * Context Assembly (AF4) — owns preparation of the context handed to the LLM. The LLM
 * NEVER decides what to retrieve; this layer does. It runs, in order:
 *   1. PRIORITISE — candidates arrive already ranked (highest score first).
 *   2. DEDUPLICATE — drop repeat ids and near-duplicate entities surfaced by >1 source.
 *   3. COMPRESS   — truncate each fragment to a per-fragment token slice.
 *   4. BUDGET     — stop adding fragments once the token budget is spent (adaptive: the
 *                   per-fragment slice shrinks as the budget fills so more items fit).
 *   5. ORDER      — keep the highest-value fragments first in the assembled text.
 * Only relevant, deduplicated, budgeted context reaches the model — the grounding contract.
 */
@Injectable()
export class ContextAssemblerService {
  assemble(candidates: RankedCandidate[], budgetTokens: number): AssembledContext {
    const deduped = dedupe(candidates);

    // Raw (pre-compression) token estimate — the denominator of the compression ratio.
    const rawTokens = deduped.reduce((sum, c) => sum + estimateTokens(fragmentBody(c)), 0);

    const budget = Math.max(0, budgetTokens);
    const perFragment = Math.max(
      MIN_FRAGMENT_TOKENS,
      Math.floor(budget / Math.max(1, Math.min(deduped.length, 12))),
    );

    const fragments: string[] = [];
    let used = 0;
    for (const c of deduped) {
      if (used >= budget) break;
      const remaining = budget - used;
      const slice = Math.min(perFragment, remaining);
      if (slice < MIN_FRAGMENT_TOKENS && fragments.length > 0) break;
      const fragment = renderFragment(c, slice);
      const cost = estimateTokens(fragment);
      if (used + cost > budget && fragments.length > 0) break;
      fragments.push(fragment);
      used += cost;
    }

    const text = fragments.join('\n\n');
    const tokenCount = estimateTokens(text);
    const compressionRatio = tokenCount > 0 ? Math.max(1, rawTokens / tokenCount) : 1;

    return {
      text,
      tokenCount,
      compressionRatio,
      fragments: fragments.length,
      evidence: collectEvidence(deduped),
    };
  }
}

/** Drop duplicate ids and near-duplicate entities (same normalized title) — keep the best. */
function dedupe(candidates: RankedCandidate[]): RankedCandidate[] {
  const byId = new Set<string>();
  const byTitle = new Set<string>();
  const out: RankedCandidate[] = [];
  for (const c of candidates) {
    const titleKey = `${c.type}:${c.title.trim().toLowerCase()}`;
    if (byId.has(c.id) || byTitle.has(titleKey)) continue;
    byId.add(c.id);
    byTitle.add(titleKey);
    out.push(c);
  }
  return out;
}

/** The compressible body of a candidate (title + summary + text), pre-budget. */
function fragmentBody(c: RankedCandidate): string {
  return [c.title, c.summary, c.text].filter((s) => s !== '').join('. ');
}

/** One labelled, compressed context fragment with an inline evidence cue. */
function renderFragment(c: RankedCandidate, sliceTokens: number): string {
  const head = `[${c.type}] ${c.title}`;
  const body = truncateToTokens(fragmentBody(c), sliceTokens);
  const cue = c.evidence[0]?.quote;
  return cue !== undefined && cue !== ''
    ? `${head}: ${body}\n  ↳ "${truncateToTokens(cue, 40)}"`
    : `${head}: ${body}`;
}

/** Union of candidate evidence, de-duplicated by (ref, quote), highest-scored first. */
function collectEvidence(candidates: RankedCandidate[]): RetrievalEvidence[] {
  const seen = new Set<string>();
  const all: RetrievalEvidence[] = [];
  for (const c of candidates) {
    for (const e of c.evidence) {
      const key = `${e.ref}::${e.quote}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(e);
    }
  }
  return all.sort((a, b) => b.score - a.score).slice(0, MAX_EVIDENCE);
}
