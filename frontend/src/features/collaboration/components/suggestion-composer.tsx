import { MAX_SUGGESTION_LENGTH } from '@qalam/shared';
import { QButton, QCard, QInput, QTextArea } from '@qalam/ui';
import { type ReactElement, useState } from 'react';

/**
 * Propose an edit (AF6, W3b).
 *
 * The contract requires an **`anchor` `{from, to}`** alongside the text — it is how the server finds
 * the passage and how it detects a later conflict. Mobile omitted it entirely, which is why its
 * create could only ever 400 (defect M-2, docs/48 §3.2).
 *
 * This surface is a standalone route, not a selection inside the editor, so there is no live
 * selection to read the offsets from. Rather than invent a plausible-looking anchor — the exact
 * mistake that produced M-2 — the offsets are asked for explicitly and default to the span implied
 * by the replaced text. A future editor-integrated composer supplies them from the real selection
 * through the app-level seam (docs/49 §4); until then the writer is told what the numbers mean.
 */
export interface SuggestionComposerProps {
  isPending: boolean;
  onSubmit: (input: {
    anchor: { from: number; to: number };
    originalText: string;
    suggestedText: string;
  }) => Promise<unknown>;
  onCancel: () => void;
}

export function SuggestionComposer({
  isPending,
  onSubmit,
  onCancel,
}: SuggestionComposerProps): ReactElement {
  const [originalText, setOriginalText] = useState('');
  const [suggestedText, setSuggestedText] = useState('');
  const [from, setFrom] = useState('0');

  const original = originalText.trim();
  const suggested = suggestedText.trim();
  const start = Number.parseInt(from, 10);
  const validStart = Number.isFinite(start) && start >= 0;
  // `to` follows from the replaced text's length — deriving it removes a field the writer would
  // otherwise have to keep consistent by hand.
  const to = validStart ? start + original.length : 0;

  const tooLong =
    original.length > MAX_SUGGESTION_LENGTH || suggested.length > MAX_SUGGESTION_LENGTH;
  const ready = original.length > 0 && suggested.length > 0 && validStart && !tooLong;

  return (
    <QCard>
      <div className="flex flex-col gap-3">
        <QTextArea
          label="Text to replace"
          aria-label="Text to replace"
          placeholder="Paste the exact wording as it appears in the piece"
          value={originalText}
          rows={2}
          onChange={(event) => setOriginalText(event.target.value)}
          hint="Must match the piece exactly — the server checks it still exists before accepting."
        />
        <QTextArea
          label="Proposed wording"
          aria-label="Proposed wording"
          value={suggestedText}
          rows={2}
          onChange={(event) => setSuggestedText(event.target.value)}
        />
        <QInput
          label="Starts at character"
          aria-label="Starts at character"
          type="number"
          min={0}
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          hint={`Offset in the piece's text. Ends at ${to}.`}
          error={validStart ? undefined : 'Enter a number of 0 or more.'}
        />
        {tooLong ? (
          <p role="alert" className="text-danger text-sm">
            Keep each passage under {MAX_SUGGESTION_LENGTH.toLocaleString()} characters.
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <QButton variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </QButton>
          <QButton
            size="sm"
            disabled={!ready}
            loading={isPending}
            onClick={() => {
              void onSubmit({
                anchor: { from: start, to },
                originalText: original,
                suggestedText: suggested,
              });
            }}
          >
            Propose edit
          </QButton>
        </div>
      </div>
    </QCard>
  );
}
