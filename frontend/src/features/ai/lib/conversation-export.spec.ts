import type { AiConversationExport } from '@qalam/api-types';
import { describe, expect, it } from 'vitest';

import { exportFilename, serializeExport } from './conversation-export';

/**
 * The export document's shape is pinned here because nothing else pins it: the route returns
 * `Promise<Record<string, unknown>>`, so the §3.11 api-types guard cannot see it (docs/48 §3.12, W8-4)
 * and Swagger records nothing. These fields are read straight off `conversation.service.ts:127-140`.
 */
const document: AiConversationExport = {
  id: '7f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f',
  feature: 'writing_assistant',
  title: 'Rain over the city',
  status: 'active',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-02T11:30:00.000Z',
  messages: [
    {
      role: 'user',
      content: 'Tighten this opening.',
      // Flat and nullable — NOT the detail route's `usage: {input,output,total} | null` (W8-3).
      totalTokens: null,
      createdAt: '2026-08-01T10:00:00.000Z',
    },
    {
      role: 'assistant',
      content: 'Here is a tighter opening.',
      totalTokens: 412,
      createdAt: '2026-08-01T10:00:04.000Z',
    },
  ],
};

describe('serializeExport', () => {
  it('round-trips the document unchanged', () => {
    expect(JSON.parse(serializeExport(document))).toEqual(document);
  });

  it('preserves the export message shape rather than the detail message shape', () => {
    const parsed = JSON.parse(serializeExport(document)) as AiConversationExport;
    const [first] = parsed.messages;
    expect(first).toHaveProperty('totalTokens');
    // The two routes disagree on purpose (W8-3); an export must not grow a `usage` object or an `id`
    // just because `AiMessageDto` has them.
    expect(first).not.toHaveProperty('usage');
    expect(first).not.toHaveProperty('id');
  });

  it('pretty-prints and ends with a newline, because a human opens this file', () => {
    const text = serializeExport(document);
    expect(text).toContain('\n  "id"');
    expect(text.endsWith('\n')).toBe(true);
  });
});

describe('exportFilename', () => {
  it('slugifies the title and keeps an id fragment for uniqueness', () => {
    expect(exportFilename(document)).toBe('qalam-conversation-rain-over-the-city-7f1c2d3e.json');
  });

  it('falls back to the full id when the conversation has no title', () => {
    expect(exportFilename({ ...document, title: null })).toBe(
      `qalam-conversation-${document.id}.json`,
    );
  });

  it('falls back when the title slugifies to nothing', () => {
    // A title of only punctuation or non-Latin script leaves an empty slug. Urdu titles are the
    // normal case on this platform, not an edge one, so this path is load-bearing.
    expect(exportFilename({ ...document, title: 'شہر پر بارش' })).toBe(
      `qalam-conversation-${document.id}.json`,
    );
  });

  it('never emits a path separator or a leading dash', () => {
    const name = exportFilename({ ...document, title: '../../etc/passwd' });
    expect(name).not.toContain('/');
    expect(name.startsWith('qalam-conversation-etc-passwd-')).toBe(true);
  });

  it('caps a long title so the filename stays usable', () => {
    const name = exportFilename({ ...document, title: 'a'.repeat(200) });
    expect(name.length).toBeLessThan(100);
  });
});
