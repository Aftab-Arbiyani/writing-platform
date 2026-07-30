import { Injectable } from '@nestjs/common';
import { RetrievalIntent } from '@qalam/shared';

/**
 * Intent detection (AF4) — the first pipeline stage. Determines WHAT the user is trying to
 * do (search / ask / explore / recommend / navigate). Deterministic and rule-based (fast,
 * free, testable); an LLM classifier could later back this behind the same method with no
 * caller change. Consumers that already know their intent (the Ask controller, the search
 * controller) pass it explicitly and detection is bypassed — this stage exists so a future
 * single generic `/ai/retrieve` entry point can route a raw request through the same plan.
 */
@Injectable()
export class IntentDetectionService {
  detect(query: string, explicit?: RetrievalIntent): RetrievalIntent {
    if (explicit !== undefined) return explicit;

    const q = query.trim().toLowerCase();
    if (q === '') return RetrievalIntent.Explore;
    if (/\b(recommend|suggest|similar|more like|related)\b/.test(q))
      return RetrievalIntent.Recommend;
    if (/\b(show all|list all|explore|browse|map of)\b/.test(q)) return RetrievalIntent.Explore;
    if (q.endsWith('?') || /\b(who|what|when|where|why|how|does|did|is|are|which)\b/.test(q)) {
      return RetrievalIntent.Ask;
    }
    return RetrievalIntent.Search;
  }
}
