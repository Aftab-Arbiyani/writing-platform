import { MAX_COMMENT_BODY_LENGTH } from '@qalam/shared';

/**
 * The text layer of composing an @mention (P-2, docs/48 §5.1).
 *
 * **The wire format, and the whole reason this file exists.** A mention is stored as `@<uuid>`
 * *inside the comment body* — `CommentService.parseMentions` re-derives `mentions[]` from the body
 * with its own `MENTION_UUID_RE` (`comment.service.ts:46`), so the body is the mention. That was
 * chosen because it is rename-proof: the stored token points at a *person*, and the name is resolved
 * fresh at render time rather than frozen into prose that goes stale.
 *
 * The cost is that a raw body is unreadable to a human — 37 characters of hex where a name belongs.
 * So the composer never shows one. A writer types and edits **handles** (`@farheen`), and this module
 * is the single translation between what they see and what the server stores:
 *
 * ```
 *   display   "nice catch @farheen"                                    ← what the textarea holds
 *   raw       "nice catch @550e8400-e29b-41d4-a716-446655440000"       ← what POSTs, and what counts
 * ```
 *
 * **Why a handle and not a pen name.** The reverse mapping has to be total, and a pen name breaks it
 * twice: pen names are not unique (two collaborators called "Ali" would be indistinguishable when
 * turning display text back into ids) and they contain spaces (so there is no token boundary to find
 * one by). A username is unique platform-wide and drawn from `[a-z0-9_]` (`Patterns.username`), which
 * makes both the tokenizer and the reverse map exact. It is also what people actually type.
 *
 * Everything here is pure so the round-trip is testable without a textarea — the display↔raw
 * translation is the part that must not drift from the server's regex.
 */

/** Characters a username can contain — the token boundary for a typed handle. */
const HANDLE_TOKEN_RE = /@([A-Za-z0-9_]+)/g;

/**
 * A stored mention: `@` + a user uuid. Deliberately identical to the server's
 * `MENTION_UUID_RE` (`comment.service.ts:46`) — if these two ever disagree, the client would count
 * and render one set of mentions while the server notified another.
 */
export const MENTION_UUID_RE = /@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

/** A person the composer may insert — the id it must write, plus what the writer sees and searches. */
export interface MentionCandidate {
  id: string;
  username: string;
  penName: string;
  /** S3 key, never a URL — the typeahead row draws an avatar through `lib/media.ts`. */
  avatarKey: string | null;
}

/** An `@…` being typed at the caret: where it starts, and what has been typed after the `@`. */
export interface MentionTrigger {
  /** Index of the `@`. */
  start: number;
  /** Text between the `@` and the caret — may be empty, which is a bare `@`. */
  query: string;
}

/**
 * The `@…` the caret currently sits inside, or `null` if the writer is not mentioning anyone.
 *
 * A trigger requires the `@` to open a word: at the start of the text, or after whitespace. That is
 * what keeps an email address from opening the typeahead on every keystroke.
 */
export function findMentionTrigger(text: string, caret: number): MentionTrigger | null {
  let index = Math.max(0, Math.min(caret, text.length));
  while (index > 0 && /[A-Za-z0-9_]/.test(text[index - 1] as string)) {
    index -= 1;
  }
  if (index === 0 || text[index - 1] !== '@') {
    return null;
  }
  const start = index - 1;
  // `@` must open a word — otherwise `you@example.com` is a mention of `example`.
  if (start > 0 && !/\s/.test(text[start - 1] as string)) {
    return null;
  }
  return { start, query: text.slice(index, caret) };
}

/** Case-insensitive match on either the handle or the pen name — people search by both. */
export function filterCandidates(
  candidates: readonly MentionCandidate[],
  query: string,
): MentionCandidate[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [...candidates];
  return candidates.filter(
    (candidate) =>
      candidate.username.toLowerCase().includes(needle) ||
      candidate.penName.toLowerCase().includes(needle),
  );
}

/**
 * Replace the `@…` at [trigger] with `@handle`, and report where the caret belongs afterwards.
 *
 * The caret is left *past* a space, which is what closes the typeahead: parked at the end of the
 * handle it would still be inside the token and the popup would reopen on the person just chosen.
 * When the writer is mentioning someone mid-sentence the following space already exists, so the caret
 * steps over it rather than a second one being inserted.
 */
export function insertMention(
  text: string,
  trigger: MentionTrigger,
  candidate: MentionCandidate,
): { text: string; caret: number } {
  const before = text.slice(0, trigger.start);
  const after = text.slice(trigger.start + 1 + trigger.query.length);
  const spaceFollows = /^\s/.test(after);
  const token = `@${candidate.username}${spaceFollows ? '' : ' '}`;
  return {
    text: `${before}${token}${after}`,
    caret: before.length + token.length + (spaceFollows ? 1 : 0),
  };
}

/**
 * Display text → the raw body the server stores, plus the ids it will notify.
 *
 * Only handles in [selected] are translated. A handle the writer typed by hand and never picked from
 * the typeahead stays literal text and notifies nobody — which is the honest outcome, because the
 * composer never confirmed *who* it meant. (`notifyComment` performs **no access check** on the ids
 * it is handed, so "whoever the writer confirmed from a list of story members" is the only safe
 * source of an id — see `use-mentionable-people.ts`.)
 *
 * The returned `mentions` is the client's own parse of its own body. The server unions it with its
 * regex over the same body (`parseMentions`), so the two agree in the happy path and any drift can
 * only make the server notify *more*, never less.
 */
export function toRawBody(
  text: string,
  selected: readonly MentionCandidate[],
): { body: string; mentions: string[] } {
  const byHandle = new Map(selected.map((c) => [c.username.toLowerCase(), c]));
  const mentions = new Set<string>();
  const body = text.replace(HANDLE_TOKEN_RE, (whole, handle: string) => {
    const candidate = byHandle.get(handle.toLowerCase());
    if (candidate === undefined) return whole;
    mentions.add(candidate.id);
    return `@${candidate.id}`;
  });
  return { body, mentions: [...mentions] };
}

/**
 * Drop candidates whose handle is no longer in the text.
 *
 * Backing out of a mention — deleting it, or editing inside the handle — has to *un-mention* the
 * person, not leave a resolved id attached to prose that no longer names them. Running this on every
 * change is what makes the character count and the "will be notified" line describe the text as it
 * actually stands.
 */
export function pruneMentions(
  text: string,
  selected: readonly MentionCandidate[],
): MentionCandidate[] {
  const present = new Set<string>();
  for (const match of text.matchAll(HANDLE_TOKEN_RE)) {
    present.add((match[1] as string).toLowerCase());
  }
  return selected.filter((candidate) => present.has(candidate.username.toLowerCase()));
}

/**
 * What the writer is actually about to send, measured the way the server measures it.
 *
 * `@MaxLength(MAX_COMMENT_BODY_LENGTH)` is applied to the **raw** string, where every mention is 37
 * characters. A composer that counted the visible text would let a writer past a limit the server
 * then rejects, with nothing on screen to explain the gap — so the count, the disabled submit and
 * the error all come from this one number.
 */
export function rawBodyLength(text: string, selected: readonly MentionCandidate[]): number {
  return toRawBody(text, selected).body.length;
}

/** Whether the raw body — not the visible text — would be refused by the server. */
export function exceedsBodyLimit(text: string, selected: readonly MentionCandidate[]): boolean {
  return rawBodyLength(text, selected) > MAX_COMMENT_BODY_LENGTH;
}

/** Split a stored body into its literal runs and its `@<uuid>` mentions, in order. */
export type BodySegment = { kind: 'text'; value: string } | { kind: 'mention'; userId: string };

/**
 * Segment a raw body for rendering (`mention-body.tsx`).
 *
 * Kept here rather than in the component so the render half is unit-testable against the same regex
 * the compose half writes with — the two directions must agree on what a mention *is*.
 */
export function segmentBody(body: string): BodySegment[] {
  const segments: BodySegment[] = [];
  let cursor = 0;
  for (const match of body.matchAll(MENTION_UUID_RE)) {
    const at = match.index;
    if (at > cursor) {
      segments.push({ kind: 'text', value: body.slice(cursor, at) });
    }
    segments.push({ kind: 'mention', userId: (match[1] as string).toLowerCase() });
    cursor = at + match[0].length;
  }
  if (cursor < body.length) {
    segments.push({ kind: 'text', value: body.slice(cursor) });
  }
  return segments;
}
