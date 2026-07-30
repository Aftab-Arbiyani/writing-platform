import { Injectable, Logger } from '@nestjs/common';
import { RetrievalSource } from '@qalam/shared';

import type { Retriever } from '../ports/retriever.port';
import type { RetrievalCandidate, RetrievalPlan, RetrievalRequest } from '../retrieval.types';

/**
 * Vector retriever (AF4) — a RESERVED EXTENSION POINT. There is no `pgvector` extension
 * or embedding store in the platform yet (docs/04), so this retriever is registered but
 * inert: `isAvailable()` returns false and it contributes nothing, and the planner/
 * RetrievalService skip it cleanly. When a vector backend later lands (pgvector, an
 * external store, or a hybrid engine behind the SearchService seam), this class gains a
 * real `retrieve()` and flips `isAvailable()` to true — with ZERO change to the planner,
 * ranker, context assembly, or any consumer. This is how AF4 supports future embeddings /
 * hybrid search / RAG / cross-book / federated retrieval without architectural change.
 */
@Injectable()
export class VectorRetriever implements Retriever {
  readonly source = RetrievalSource.Vector;

  private readonly logger = new Logger(VectorRetriever.name);

  isAvailable(): boolean {
    // No embedding backend configured — see docs/36 §"Future compatibility".
    return false;
  }

  async retrieve(_plan: RetrievalPlan, _request: RetrievalRequest): Promise<RetrievalCandidate[]> {
    this.logger.debug('vector source not configured — skipped (reserved extension point)');
    return Promise.resolve([]);
  }
}
