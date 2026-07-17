import { Inject, Injectable, Optional } from '@nestjs/common';

import { AI_CONTEXT_PROVIDERS } from './context-builder.port';
import type {
  AiContextScope,
  ContextFragment,
  ContextProvider,
  ContextRequest,
} from './context-builder.port';

/**
 * Resolves a list of {@link ContextRequest}s into text fragments by dispatching
 * each to its registered {@link ContextProvider}. Unknown types are skipped
 * (forward-compatible: a client can request a context type a newer feature will
 * provide). This is the single entry point the orchestrator uses to assemble
 * context — so every AI feature gets the same pluggable context pipeline.
 */
@Injectable()
export class ContextRegistryService {
  private readonly byType = new Map<string, ContextProvider>();

  constructor(@Optional() @Inject(AI_CONTEXT_PROVIDERS) providers: ContextProvider[] | null) {
    for (const provider of providers ?? []) {
      this.byType.set(provider.type, provider);
    }
  }

  /** Context types currently registered. */
  availableTypes(): string[] {
    return [...this.byType.keys()];
  }

  /** Resolve every request that has a registered provider into a fragment. */
  async resolve(requests: ContextRequest[], scope: AiContextScope): Promise<ContextFragment[]> {
    const fragments: ContextFragment[] = [];
    for (const request of requests) {
      const provider = this.byType.get(request.type);
      if (provider === undefined) {
        continue; // unknown context type — skip, don't fail the whole call
      }
      const fragment = await provider.build(request.params ?? {}, scope);
      if (fragment !== null) {
        fragments.push(fragment);
      }
    }
    return fragments;
  }

  /** Compose fragments into a single context block for the prompt. */
  compose(fragments: ContextFragment[]): string {
    return fragments.map((fragment) => `## ${fragment.label}\n${fragment.text}`).join('\n\n');
  }
}
