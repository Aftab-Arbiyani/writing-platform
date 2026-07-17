import { Injectable } from '@nestjs/common';

import type { AiContextScope, ContextFragment, ContextProvider } from '../context-builder.port';

/**
 * Selected-text context (AF1) — self-contained (the text comes in the request,
 * no other module needed). The canonical example of a context provider and the
 * one most writing features will use ("act on this selection").
 */
@Injectable()
export class SelectionContextBuilder implements ContextProvider {
  readonly type = 'selection';

  build(params: Record<string, unknown>, _scope: AiContextScope): ContextFragment | null {
    const text = typeof params.text === 'string' ? params.text.trim() : '';
    if (text === '') {
      return null;
    }
    return { label: 'Selected text', text };
  }
}
