import { COMMENT_MAX_LENGTH, COMMENT_MIN_LENGTH } from '@qalam/shared';
import { QButton, QTextArea } from '@qalam/ui';
import { type ReactElement, useState } from 'react';

/**
 * Write a comment or a reply on a piece (W7a, docs/45 §4.4).
 *
 * One control, two uses: a top-level comment and a reply post to different endpoints
 * (`POST /pieces/:id/comments` and `POST /comments/:id/replies`) but carry the **same**
 * `CreateCommentDto` — `{ body }` and nothing else. The parent comes from the URL. Editing
 * (`PATCH /comments/:id`) reuses it a third time, prefilled.
 *
 * **Length comes from `@qalam/shared`**, not from a number typed here: `COMMENT_MIN_LENGTH` /
 * `COMMENT_MAX_LENGTH` are the same constants the DTO's `@Length` validator uses, so the client's
 * refusal and the server's cannot drift apart. `QTextArea` renders and `aria-describedby`-links the
 * message itself, so the disabled button always has a stated reason.
 *
 * **No @mentions.** `CreateCommentDto` has no `mentions` field at all, and composing them is P-2 —
 * a separate slice that touches both clients (docs/48 §5.1). A typed `@handle` stays plain text
 * rather than silently failing to notify anyone.
 *
 * Sign-in gating is the caller's concern: this control is not rendered for a signed-out reader.
 */
export interface CommentComposerProps {
  /** Resolves when the write settles. Rejecting keeps the text — a failed post must not lose it. */
  onSubmit: (body: string) => Promise<unknown>;
  isPending: boolean;
  placeholder?: string;
  submitLabel?: string;
  /** Accessible name for the field. Distinct per instance so a thread is navigable by label. */
  label?: string;
  /** Compact form for a reply or an inline edit nested inside a thread (label becomes implicit). */
  dense?: boolean;
  /** Prefill — the current body when editing an existing comment. */
  initialBody?: string;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export function CommentComposer({
  onSubmit,
  isPending,
  placeholder = 'Add a comment…',
  submitLabel = 'Comment',
  label = 'Comment',
  dense = false,
  initialBody = '',
  onCancel,
  autoFocus = false,
}: CommentComposerProps): ReactElement {
  const [body, setBody] = useState(initialBody);

  const trimmed = body.trim();
  const tooShort = trimmed.length < COMMENT_MIN_LENGTH;
  const tooLong = trimmed.length > COMMENT_MAX_LENGTH;
  const error = tooLong
    ? `Keep it under ${COMMENT_MAX_LENGTH.toLocaleString('en')} characters.`
    : undefined;

  const submit = async (): Promise<void> => {
    if (tooShort || tooLong || isPending) return;
    await onSubmit(trimmed);
    // Only clear once the write has settled — a rejected promise keeps what was typed.
    setBody('');
  };

  return (
    <div className="flex flex-col gap-2">
      <QTextArea
        label={dense ? undefined : label}
        aria-label={dense ? label : undefined}
        placeholder={placeholder}
        value={body}
        rows={dense ? 2 : 3}
        autoFocus={autoFocus}
        onChange={(event) => setBody(event.target.value)}
        error={error}
      />
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <QButton variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </QButton>
        ) : null}
        <QButton
          size="sm"
          disabled={tooShort || tooLong}
          loading={isPending}
          onClick={() => {
            void submit();
          }}
        >
          {submitLabel}
        </QButton>
      </div>
    </div>
  );
}
