/**
 * The retriever port (AF4). A retriever turns a {@link RetrievalPlan} + request into raw
 * candidates from ONE source (the knowledge graph, metadata, keyword index, or a future
 * vector store). Every retriever registers under the {@link RETRIEVERS} multi-token from
 * its owning providers list, so adding a source (e.g. vectors, cross-book, federated) is
 * a new adapter class — never a change to the planner or the RetrievalService. This is
 * the direct analogue of AF1's provider/context ports: one seam, many implementations.
 */
import type { RetrievalSource } from '@qalam/shared';

import type { RetrievalCandidate, RetrievalPlan, RetrievalRequest } from '../retrieval.types';

export interface Retriever {
  /** The source this retriever answers for (matches the plan's `sources`). */
  readonly source: RetrievalSource;
  /**
   * Whether this retriever can run right now. A reserved source with no backend yet
   * (e.g. `vector` before a store is configured) returns false and is skipped — the
   * pipeline degrades cleanly with zero code change when the backend later lands.
   */
  isAvailable(): boolean | Promise<boolean>;
  /** Produce candidates for this source. Bounded by `plan.candidatesPerSource`. */
  retrieve(plan: RetrievalPlan, request: RetrievalRequest): Promise<RetrievalCandidate[]>;
}

/** Multi-provider DI token — every retriever registers under it. */
export const RETRIEVERS = Symbol('RETRIEVERS');
