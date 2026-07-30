import { Injectable } from '@nestjs/common';

import type { AiContextScope, ContextFragment, ContextProvider } from '../context-builder.port';

/**
 * Writing-metadata context (AF1) — formats caller-provided piece metadata
 * (title, genre, language, tags, word count) into a fragment. Self-contained:
 * the values are passed in, so no cross-module dependency. The Current-Piece /
 * Previous-Chapters providers that need to LOAD piece data are registered later
 * by the pieces feature against the same {@link ContextProvider} port.
 */
@Injectable()
export class WritingMetadataContextBuilder implements ContextProvider {
  readonly type = 'writing_metadata';

  build(params: Record<string, unknown>, _scope: AiContextScope): ContextFragment | null {
    const lines: string[] = [];
    const add = (label: string, key: string): void => {
      const value = params[key];
      if (typeof value === 'string' && value.trim() !== '') {
        lines.push(`${label}: ${value.trim()}`);
      } else if (typeof value === 'number') {
        lines.push(`${label}: ${value}`);
      }
    };
    add('Title', 'title');
    add('Genre', 'genre');
    add('Language', 'language');
    add('Word count', 'wordCount');
    if (Array.isArray(params.tags) && params.tags.length > 0) {
      lines.push(`Tags: ${params.tags.map((tag) => String(tag)).join(', ')}`);
    }
    if (lines.length === 0) {
      return null;
    }
    return { label: 'Writing metadata', text: lines.join('\n') };
  }
}
