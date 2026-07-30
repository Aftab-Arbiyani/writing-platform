import { MAX_COMMENT_BODY_LENGTH } from '@qalam/shared';
import { QButton, QTextArea } from '@qalam/ui';
import { type ReactElement, useState } from 'react';

/**
 * Write a comment or a reply (AF6, W3b). One control, two uses — a root comment on the story and a
 * reply inside a thread post to different endpoints, but the writer's act is the same.
 *
 * **Mentions are displayed, not composed** (docs/49 §5 names "@mention display"). The wire takes
 * `mentions` as resolved **user ids**, so a composer would need to resolve every typed handle to an
 * id the way the invite dialog does. That is a surface of its own and is not in this row — so
 * nothing is sent, and a typed `@handle` stays plain text rather than silently failing to notify.
 */
export interface CommentComposerProps {
  onSubmit: (body: string) => Promise<unknown>;
  isPending: boolean;
  placeholder?: string;
  submitLabel?: string;
  /** Compact form for a reply nested inside a thread. */
  dense?: boolean;
  onCancel?: () => void;
}

export function CommentComposer({
  onSubmit,
  isPending,
  placeholder = 'Add a comment…',
  submitLabel = 'Comment',
  dense = false,
  onCancel,
}: CommentComposerProps): ReactElement {
  const [body, setBody] = useState('');
  const trimmed = body.trim();
  const tooLong = trimmed.length > MAX_COMMENT_BODY_LENGTH;

  const submit = async (): Promise<void> => {
    if (!trimmed || tooLong) return;
    await onSubmit(trimmed);
    // Only clear on success — a failed post must not lose what the writer typed.
    setBody('');
  };

  return (
    <div className="flex flex-col gap-2">
      <QTextArea
        label={dense ? undefined : 'Comment'}
        aria-label={dense ? 'Reply' : 'Comment'}
        placeholder={placeholder}
        value={body}
        rows={dense ? 2 : 3}
        onChange={(event) => setBody(event.target.value)}
        error={
          tooLong
            ? `Keep it under ${MAX_COMMENT_BODY_LENGTH.toLocaleString()} characters.`
            : undefined
        }
      />
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
  );
}
