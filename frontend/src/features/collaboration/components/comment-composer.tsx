import { MAX_COMMENT_BODY_LENGTH } from '@qalam/shared';
import { QButton } from '@qalam/ui';
import { type ReactElement, useState } from 'react';

import { useMentionablePeople } from '../hooks/use-mentionable-people';
import {
  type MentionCandidate,
  pruneMentions,
  rawBodyLength,
  toRawBody,
} from '../lib/mention-text';
import { MentionTextarea } from './mention-textarea';

/**
 * Write a comment or a reply (AF6, W3b). One control, two uses — a root comment on the story and a
 * reply inside a thread post to different endpoints, but the writer's act is the same.
 *
 * **Mentions are composed here as of P-2** (docs/48 §5.1); this docblock previously recorded the
 * deferral, which has happened. Typing `@` opens a typeahead over the story's own roster, and picking
 * someone inserts their **handle** into the visible text. At submit the handle is rewritten to the
 * `@<uuid>` the wire stores (`mention-text.ts`), and the resolved ids are sent alongside it. Three
 * things about that are worth knowing before changing this file:
 *
 * - **The writer never sees a UUID.** The textarea holds handles; ids exist only in what is POSTed
 *   and in what comes back, where `MentionBody` resolves them to names again.
 * - **The counter counts the RAW body.** `@MaxLength(MAX_COMMENT_BODY_LENGTH)` is applied server-side
 *   to the string containing the ids, where each mention is 37 characters rather than the handful the
 *   writer can see. Counting the visible text would let someone past a limit the server then
 *   rejects, with nothing on screen to explain why — so the count, the disabled submit and the error
 *   all read from `rawBodyLength`, and the hint says so out loud once a mention is in play.
 * - **Only people who can open the story are offered** — see `use-mentionable-people.ts` for why that
 *   is a safety property and not a nicety.
 *
 * `storyId` is required because the mentionable set is story-scoped; a reply composer passes the same
 * one as its thread.
 */
export interface CommentComposerProps {
  storyId: string;
  onSubmit: (input: { body: string; mentions: string[] }) => Promise<unknown>;
  isPending: boolean;
  placeholder?: string;
  submitLabel?: string;
  /** Compact form for a reply nested inside a thread. */
  dense?: boolean;
  onCancel?: () => void;
}

export function CommentComposer({
  storyId,
  onSubmit,
  isPending,
  placeholder = 'Add a comment…',
  submitLabel = 'Comment',
  dense = false,
  onCancel,
}: CommentComposerProps): ReactElement {
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState<MentionCandidate[]>([]);
  // The roster is fetched on the first `@`, not on mount — a comment with no mention costs nothing.
  const [wantsMentions, setWantsMentions] = useState(false);
  const { candidates } = useMentionablePeople(storyId, wantsMentions);

  const trimmed = text.trim();
  const rawLength = rawBodyLength(trimmed, mentions);
  const tooLong = rawLength > MAX_COMMENT_BODY_LENGTH;

  const submit = async (): Promise<void> => {
    if (!trimmed || tooLong) return;
    await onSubmit(toRawBody(trimmed, mentions));
    // Only clear on success — a failed post must not lose what the writer typed.
    setText('');
    setMentions([]);
  };

  return (
    <div className="flex flex-col gap-2">
      <MentionTextarea
        label={dense ? undefined : 'Comment'}
        ariaLabel={dense ? 'Reply' : 'Comment'}
        placeholder={placeholder}
        value={text}
        rows={dense ? 2 : 3}
        candidates={candidates}
        onMentionIntent={() => setWantsMentions(true)}
        onMention={(candidate) =>
          setMentions((current) =>
            current.some((c) => c.id === candidate.id) ? current : [...current, candidate],
          )
        }
        onChange={(next) => {
          setText(next);
          // Deleting or editing a mention un-mentions the person, so the count and the ids sent stay
          // true to the text as it now reads.
          setMentions((current) => pruneMentions(next, current));
        }}
        error={
          tooLong
            ? `Keep it under ${MAX_COMMENT_BODY_LENGTH.toLocaleString()} characters.`
            : undefined
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {/*
         * Shown only once a mention is present, and only near the limit otherwise: the gap between
         * what the writer can see and what the server counts is confusing precisely because it is
         * invisible, so it is named rather than left to be discovered at rejection time.
         */}
        <p className="text-ink-muted text-xs" aria-live="polite">
          {mentions.length > 0 ? (
            <>
              {rawLength.toLocaleString()} / {MAX_COMMENT_BODY_LENGTH.toLocaleString()} characters —
              each mention counts as the person’s id, not their name.
            </>
          ) : rawLength > MAX_COMMENT_BODY_LENGTH - 200 ? (
            <>
              {rawLength.toLocaleString()} / {MAX_COMMENT_BODY_LENGTH.toLocaleString()} characters
            </>
          ) : null}
        </p>

        <div className="flex justify-end gap-2">
          {onCancel ? (
            <QButton variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </QButton>
          ) : null}
          <QButton
            size="sm"
            disabled={trimmed.length === 0 || tooLong}
            loading={isPending}
            onClick={() => {
              void submit();
            }}
          >
            {submitLabel}
          </QButton>
        </div>
      </div>
    </div>
  );
}
