import { MAX_SUGGESTION_LENGTH, POLICY_ACTIONS } from '@qalam/shared';
import { QButton, QDialog, QTextArea, useToast } from '@qalam/ui';
import { PenLine, X } from 'lucide-react';
import { type ReactElement, useState } from 'react';

import { getErrorMessage } from '@/lib/errors';
import { useSuggestTarget } from '@/stores/suggest-target.store';

import { useSuggestionActions } from '../hooks/use-suggestions';
import { isCollaborationEnabled } from '../lib/collaboration-enabled';
import { CapabilityGate } from './capability-gate';

/**
 * "Propose an edit", mounted on the reader (AF6, C-15 — docs/48 §3.22a).
 *
 * **Whole-passage granularity, and that is an owner decision rather than a shortcut** (2026-08-21):
 * the reader picks a whole paragraph or heading, because neither client has drag-select
 * infrastructure anywhere — comments have the identical gap. Mobile shipped exactly this shape and
 * it is live-verified against a running backend; this is the same product, not a web variant.
 *
 * **Why it lives here and mounts there.** The prose and its anchors belong to `features/reading`;
 * suggestions, the capability check and `addSuggestion` belong here; and a feature may never import
 * another feature (docs/26 §4). So the two halves meet on the app-level
 * [`suggest-target`](../../../stores/suggest-target.store.ts) seam and
 * [`app/routes/piece.tsx`](../../../app/routes/piece.tsx) composes them — the same arrangement W2
 * uses for the editor and the AI panel.
 *
 * **The offsets are never typed by a human.** The reader hands over the anchor it computed from the
 * document itself (`features/reading/lib/content-anchors.ts`), in the server's `anchorText`
 * coordinate space. The composer that asked a writer to type "Starts at character" by hand could
 * only ever 409 against the offset-exact check, which is the defect this replaces.
 */
export function SuggestEditAffordance(): ReactElement | null {
  const storyId = useSuggestTarget((s) => s.storyId);

  // No reader has registered — nothing to suggest against. Also the state on every other surface,
  // which is why mounting this component anywhere else is harmless rather than wrong.
  if (storyId === null || !isCollaborationEnabled()) return null;

  return (
    <CapabilityGate storyId={storyId} action={POLICY_ACTIONS.StorySuggest}>
      <SuggestEditControls storyId={storyId} />
    </CapabilityGate>
  );
}

/**
 * Split from the gate so no hook runs for a viewer who may not suggest — `CapabilityGate` fails
 * closed while its capability query is in flight, and hooks above it would run on every reader
 * regardless.
 */
function SuggestEditControls({ storyId }: { storyId: string }): ReactElement {
  const picking = useSuggestTarget((s) => s.picking);
  const setPicking = useSuggestTarget((s) => s.setPicking);
  const selection = useSuggestTarget((s) => s.selection);
  const clearSelection = useSuggestTarget((s) => s.clearSelection);

  return (
    <>
      {picking ? (
        <div
          role="status"
          className="border-line bg-raised flex items-center gap-3 rounded-md border px-3 py-2"
        >
          <PenLine size={16} strokeWidth={1.5} aria-hidden className="text-accent" />
          <p className="text-ink-secondary text-sm">Pick the paragraph you want to change.</p>
          <QButton
            variant="ghost"
            size="sm"
            icon={X}
            className="ms-auto"
            onClick={() => setPicking(false)}
          >
            Cancel
          </QButton>
        </div>
      ) : (
        <QButton variant="secondary" size="sm" icon={PenLine} onClick={() => setPicking(true)}>
          Suggest an edit
        </QButton>
      )}

      {/* Mounted only while a passage is selected — same posture as `ReportAction`'s dialog: a long
          piece carries no composer state until someone actually picks something. */}
      {selection === null ? null : (
        <SuggestEditDialog
          storyId={storyId}
          selection={selection}
          onClose={clearSelection}
          onSent={() => {
            clearSelection();
            setPicking(false);
          }}
        />
      )}
    </>
  );
}

function SuggestEditDialog({
  storyId,
  selection,
  onClose,
  onSent,
}: {
  storyId: string;
  selection: { from: number; to: number; text: string };
  onClose: () => void;
  onSent: () => void;
}): ReactElement {
  const toast = useToast();
  const { addSuggestion } = useSuggestionActions(storyId);
  const [suggestedText, setSuggestedText] = useState('');

  const suggested = suggestedText.trim();
  const tooLong = suggested.length > MAX_SUGGESTION_LENGTH;
  const ready = suggested.length > 0 && !tooLong;

  const submit = (): void => {
    if (!ready) return;
    addSuggestion.mutate(
      {
        anchor: { from: selection.from, to: selection.to },
        // The passage exactly as the document holds it. The server re-derives it from the piece and
        // refuses a mismatch, so this is a checksum on the anchor rather than a copy of the prose.
        originalText: selection.text,
        suggestedText: suggested,
      },
      {
        onSuccess: () => {
          toast.success('Suggestion sent', {
            description: 'The author will see it alongside the piece.',
          });
          onSent();
        },
        // A conflict here means the prose moved under the anchor between load and submit. It is a
        // real and expected outcome, so it is reported as what happened rather than swallowed —
        // the shared catalogue already renders SUGGESTION_CONFLICT in the reader's language.
        onError: (err) => {
          toast.error('Couldn’t send the suggestion', { description: getErrorMessage(err) });
        },
      },
    );
  };

  return (
    <QDialog
      open
      onClose={onClose}
      title="Suggest an edit"
      description="Propose new wording for this passage. The author can accept or decline it."
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <QButton variant="ghost" onClick={onClose}>
            Cancel
          </QButton>
          <QButton loading={addSuggestion.isPending} disabled={!ready} onClick={submit}>
            Send suggestion
          </QButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-ink mb-1 text-sm font-medium">Original</p>
          {/* Read-only on purpose: it is the anchor's own text, and an editable copy would let the
              two drift into a guaranteed conflict. Mobile shows it the same way. */}
          <blockquote className="border-line bg-raised text-ink-secondary rounded-md border p-3 text-sm italic">
            {selection.text}
          </blockquote>
        </div>

        <QTextArea
          label="Your suggested wording"
          aria-label="Your suggested wording"
          value={suggestedText}
          rows={4}
          autoFocus
          onChange={(event) => setSuggestedText(event.target.value)}
          hint={`${String(suggested.length)} / ${MAX_SUGGESTION_LENGTH.toLocaleString()}`}
          error={
            tooLong
              ? `Keep it under ${MAX_SUGGESTION_LENGTH.toLocaleString()} characters.`
              : undefined
          }
        />
      </div>
    </QDialog>
  );
}
