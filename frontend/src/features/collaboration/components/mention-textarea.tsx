import { QAvatar, QTextArea } from '@qalam/ui';
import { type KeyboardEvent, type ReactElement, useEffect, useId, useRef, useState } from 'react';

import { mediaUrl } from '@/lib/media';

import {
  type MentionCandidate,
  filterCandidates,
  findMentionTrigger,
  insertMention,
} from '../lib/mention-text';

/**
 * A comment textarea whose `@` opens a typeahead over people (P-2, docs/48 §5.1).
 *
 * **Why this wraps `QTextArea` rather than replacing it with a rich input.** The alternative — a
 * `contenteditable` holding real chip nodes — buys nothing here and costs a great deal: selection and
 * IME handling, paste normalisation, and a caret that has to be re-derived on every mutation, on a
 * surface where mixed-direction Urdu/English text is a first-class case (docs/07 §7.2). This keeps a
 * plain textarea, and moves the display↔raw translation to submit time (`mention-text.ts`), where it
 * is a pure function over the final string. The writer sees `@farheen`; the server is sent
 * `@<uuid>`; nothing in between has to track node positions.
 *
 * So there is exactly one thing this component adds to a textarea: the popup, and the keyboard on it.
 *
 * **Combobox semantics.** The textarea IS the combobox (`aria-controls` → the listbox,
 * `aria-activedescendant` → the highlighted option, `aria-autocomplete="list"`), which is how a screen
 * reader announces the active person while the caret stays in the text — the pattern the command
 * palette already uses (`command-palette.tsx:326`). Options carry `role="option"` + `aria-selected`
 * and are held out of the Tab order, so Tab inserts the highlighted person instead of walking the
 * list. A polite live region announces how many people match, because a silently-appearing popup is
 * invisible to a screen-reader user.
 *
 * The first option is highlighted by default: Enter with a query typed should mention the obvious
 * person, not fall through and post the comment mid-mention.
 */
export interface MentionTextareaProps {
  value: string;
  onChange: (next: string) => void;
  /** Called when a person is picked, so the composer can hold the id for submit. */
  onMention: (candidate: MentionCandidate) => void;
  candidates: readonly MentionCandidate[];
  /** Told when the writer first opens a mention, so the roster is fetched then and not on page load. */
  onMentionIntent: () => void;
  label?: string;
  ariaLabel: string;
  placeholder?: string;
  rows?: number;
  error?: string;
}

export function MentionTextarea({
  value,
  onChange,
  onMention,
  candidates,
  onMentionIntent,
  label,
  ariaLabel,
  placeholder,
  rows = 3,
  error,
}: MentionTextareaProps): ReactElement {
  const listboxId = `${useId()}-mentions`;
  const optionId = (index: number): string => `${listboxId}-option-${index}`;

  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState(0);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  // Set when a mention is inserted; applied after React has painted the new value.
  const pendingCaret = useRef<number | null>(null);

  const trigger = open ? findMentionTrigger(value, caret) : null;
  const matches = trigger === null ? [] : filterCandidates(candidates, trigger.query);
  // A popup with nothing in it is noise — and an empty listbox announces as one.
  const expanded = trigger !== null && matches.length > 0;

  // A shorter match list must never leave the highlight past the end.
  useEffect(() => {
    setActiveIndex((current) => (current >= matches.length ? 0 : current));
  }, [matches.length]);

  useEffect(() => {
    const next = pendingCaret.current;
    const area = areaRef.current;
    if (next === null || area === null) return;
    pendingCaret.current = null;
    area.setSelectionRange(next, next);
    setCaret(next);
  }, [value]);

  const select = (candidate: MentionCandidate): void => {
    if (trigger === null) return;
    const inserted = insertMention(value, trigger, candidate);
    pendingCaret.current = inserted.caret;
    onChange(inserted.text);
    onMention(candidate);
    setActiveIndex(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!expanded) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % matches.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + matches.length) % matches.length);
        break;
      case 'Enter':
      case 'Tab': {
        const candidate = matches[activeIndex];
        if (candidate === undefined) return;
        event.preventDefault();
        select(candidate);
        break;
      }
      case 'Escape':
        // Backing out leaves whatever was typed as plain text — never a half-written mention, and
        // never anyone notified. `setOpen(false)` is enough: nothing has been resolved yet.
        event.preventDefault();
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className="relative flex flex-col">
      <QTextArea
        label={label}
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        rows={rows}
        error={error}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-activedescendant={expanded ? optionId(activeIndex) : undefined}
        aria-autocomplete="list"
        onKeyDown={handleKeyDown}
        onChange={(event) => {
          const { value: next, selectionStart } = event.target;
          const at = selectionStart ?? next.length;
          setCaret(at);
          // Opening on the `@` itself is what makes the roster fetch lazy — and what lets a bare
          // `@` list everyone, which is how a writer discovers the feature exists.
          if (findMentionTrigger(next, at) !== null) {
            if (!open) onMentionIntent();
            setOpen(true);
          } else {
            setOpen(false);
          }
          onChange(next);
        }}
        // Clicking or arrowing elsewhere moves the caret out of the mention; the popup must follow.
        onSelect={(event) => {
          const target = event.target as HTMLTextAreaElement;
          areaRef.current = target;
          setCaret(target.selectionStart ?? 0);
        }}
        onFocus={(event) => {
          areaRef.current = event.target as HTMLTextAreaElement;
        }}
        onBlur={() => setOpen(false)}
      />

      {/* Announced rather than merely drawn — the popup's arrival is otherwise silent. */}
      <span aria-live="polite" className="sr-only">
        {expanded
          ? `${matches.length} ${matches.length === 1 ? 'person' : 'people'} available. Use the arrow keys to choose who to mention.`
          : ''}
      </span>

      <ul
        id={listboxId}
        role="listbox"
        aria-label="People on this story"
        // Kept mounted so `aria-controls` always points at a real element, and hidden from both the
        // screen reader and the layout when there is nothing to choose.
        hidden={!expanded}
        className={
          expanded
            ? 'border-line bg-canvas absolute bottom-full z-10 mb-1 max-h-56 w-full overflow-y-auto rounded-md border p-1 shadow-[var(--q-shadow-2)]'
            : 'hidden'
        }
      >
        {matches.map((candidate, index) => (
          <li key={candidate.id}>
            <button
              type="button"
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              // Driven by aria-activedescendant on the textarea — Tab must not walk the list.
              tabIndex={-1}
              onMouseMove={() => {
                if (index !== activeIndex) setActiveIndex(index);
              }}
              // The textarea's blur would close the popup before a click could land.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(candidate)}
              className={[
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm',
                index === activeIndex ? 'bg-raised text-ink' : 'text-ink-secondary',
              ].join(' ')}
            >
              <QAvatar size={24} name={candidate.penName} src={mediaUrl(candidate.avatarKey)} />
              <span className="text-ink font-medium">
                <bdi>{candidate.penName}</bdi>
              </span>
              <span className="text-ink-muted text-xs">@{candidate.username}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
