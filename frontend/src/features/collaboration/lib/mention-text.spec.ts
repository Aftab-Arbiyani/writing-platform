import { MAX_COMMENT_BODY_LENGTH } from '@qalam/shared';
import { describe, expect, it } from 'vitest';

import {
  type MentionCandidate,
  MENTION_UUID_RE,
  exceedsBodyLimit,
  filterCandidates,
  findMentionTrigger,
  insertMention,
  pruneMentions,
  rawBodyLength,
  segmentBody,
  toRawBody,
} from './mention-text';

/**
 * The display↔raw translation P-2 rests on (docs/48 §5.1).
 *
 * These are the assertions that stop the two halves of the feature drifting apart: the composer writes
 * `@<uuid>` into a body and the thread reads `@<uuid>` back out of one, and if this module's idea of
 * what a mention looks like ever differs from `comment.service.ts`'s regex, one side notifies people
 * the other never showed.
 */
const FARHEEN: MentionCandidate = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  username: 'farheen',
  penName: 'Farheen Q',
  avatarKey: null,
};
const ALI: MentionCandidate = {
  id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  username: 'ali',
  penName: 'Ali R',
  avatarKey: null,
};

describe('findMentionTrigger', () => {
  it('opens on an @ that starts a word', () => {
    expect(findMentionTrigger('@far', 4)).toEqual({ start: 0, query: 'far' });
    expect(findMentionTrigger('nice catch @far', 15)).toEqual({ start: 11, query: 'far' });
  });

  it('opens on a bare @, so a writer can browse the roster', () => {
    expect(findMentionTrigger('nice @', 6)).toEqual({ start: 5, query: '' });
  });

  it('does not open mid-word — an email address is not a mention', () => {
    expect(findMentionTrigger('you@example.com', 11)).toBeNull();
  });

  it('closes once the caret leaves the token', () => {
    // The trailing space `insertMention` adds is what puts the caret outside the handle.
    expect(findMentionTrigger('@farheen ', 9)).toBeNull();
  });
});

describe('filterCandidates', () => {
  const people = [FARHEEN, ALI];

  it('matches on handle or pen name, case-insensitively', () => {
    expect(filterCandidates(people, 'FAR')).toEqual([FARHEEN]);
    expect(filterCandidates(people, 'ali r')).toEqual([ALI]);
  });

  it('offers everyone for a bare @', () => {
    expect(filterCandidates(people, '')).toEqual(people);
  });
});

describe('insertMention', () => {
  it('inserts the handle, not the id, and parks the caret after it', () => {
    const trigger = findMentionTrigger('nice catch @far', 15);
    const result = insertMention('nice catch @far', trigger!, FARHEEN);

    expect(result.text).toBe('nice catch @farheen ');
    expect(result.text).not.toContain(FARHEEN.id);
    expect(result.caret).toBe(result.text.length);
    // Caret outside the token → the popup does not reopen on the person just chosen.
    expect(findMentionTrigger(result.text, result.caret)).toBeNull();
  });

  it('replaces only the partial handle, leaving the rest of the sentence alone', () => {
    const text = 'ask @fa about the ending';
    const result = insertMention(text, findMentionTrigger(text, 7)!, FARHEEN);

    // No doubled space: the sentence already had one, so the caret steps over it instead.
    expect(result.text).toBe('ask @farheen about the ending');
    expect(findMentionTrigger(result.text, result.caret)).toBeNull();
  });
});

describe('toRawBody', () => {
  it('rewrites a selected handle to @<uuid> and reports the id', () => {
    const { body, mentions } = toRawBody('nice catch @farheen', [FARHEEN]);

    expect(body).toBe(`nice catch @${FARHEEN.id}`);
    expect(mentions).toEqual([FARHEEN.id]);
    // The server's own regex must find the same thing in the same body.
    expect([...body.matchAll(MENTION_UUID_RE)].map((m) => m[1])).toEqual([FARHEEN.id]);
  });

  it('leaves a handle that was never picked from the typeahead as plain text', () => {
    const { body, mentions } = toRawBody('what about @someone_else', [FARHEEN]);

    expect(body).toBe('what about @someone_else');
    expect(mentions).toEqual([]);
  });

  it('handles two different people in one comment', () => {
    const { body, mentions } = toRawBody('@farheen and @ali — thoughts?', [FARHEEN, ALI]);

    expect(body).toBe(`@${FARHEEN.id} and @${ALI.id} — thoughts?`);
    expect(mentions).toEqual([FARHEEN.id, ALI.id]);
  });

  it('deduplicates a person mentioned twice', () => {
    expect(toRawBody('@farheen and @farheen', [FARHEEN]).mentions).toEqual([FARHEEN.id]);
  });
});

describe('pruneMentions', () => {
  it('drops a mention the writer has deleted', () => {
    expect(pruneMentions('nice catch', [FARHEEN])).toEqual([]);
  });

  it('drops a mention the writer has edited mid-handle, rather than leaving a stale id attached', () => {
    expect(pruneMentions('nice catch @farhee', [FARHEEN])).toEqual([]);
  });

  it('keeps one that is still there', () => {
    expect(pruneMentions('nice catch @farheen', [FARHEEN, ALI])).toEqual([FARHEEN]);
  });
});

describe('rawBodyLength', () => {
  it('counts the id, not the handle — the number the server enforces on', () => {
    const text = '@farheen';
    expect(text.length).toBe(8);
    expect(rawBodyLength(text, [FARHEEN])).toBe(37);
  });

  it('catches a comment that only exceeds the limit once the ids are substituted', () => {
    // Visible text is comfortably under; the raw body is not. This is the case a visible-character
    // counter would wave through and the server would then reject with nothing to explain it.
    const padding = 'x'.repeat(MAX_COMMENT_BODY_LENGTH - 20);
    const text = `${padding} @farheen @ali`;

    expect(text.length).toBeLessThan(MAX_COMMENT_BODY_LENGTH);
    expect(exceedsBodyLimit(text, [FARHEEN, ALI])).toBe(true);
  });

  it('does not flag a comment whose unresolved handles stay short', () => {
    const text = `${'x'.repeat(MAX_COMMENT_BODY_LENGTH - 20)} @nobody_here`;
    expect(exceedsBodyLimit(text, [FARHEEN])).toBe(false);
  });
});

describe('segmentBody', () => {
  it('splits a stored body into text and mention runs', () => {
    expect(segmentBody(`hi @${FARHEEN.id} and @${ALI.id}!`)).toEqual([
      { kind: 'text', value: 'hi ' },
      { kind: 'mention', userId: FARHEEN.id },
      { kind: 'text', value: ' and ' },
      { kind: 'mention', userId: ALI.id },
      { kind: 'text', value: '!' },
    ]);
  });

  it('leaves a body with no mentions as a single run', () => {
    expect(segmentBody('just prose')).toEqual([{ kind: 'text', value: 'just prose' }]);
  });

  it('round-trips what the composer produced', () => {
    const { body } = toRawBody('@farheen look here', [FARHEEN]);
    expect(segmentBody(body)).toEqual([
      { kind: 'mention', userId: FARHEEN.id },
      { kind: 'text', value: ' look here' },
    ]);
  });
});
