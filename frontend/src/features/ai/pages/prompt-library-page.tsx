import { QButton, QCard, QInput, QTag, QTextArea, useConfirm, useToast } from '@qalam/ui';
import { Copy, PenLine, Star, Trash2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';

import { BUILT_IN_PROMPT_PRESETS, presetKindLabel, type PromptPreset } from '../lib/prompt-presets';
import { usePromptLibraryStore } from '../stores/prompt-library.store';

/**
 * Prompt Library (`/settings/ai/prompts`, W8 C2) — ported from mobile's `prompt_library_screen`.
 *
 * **Entirely client-side, and that is the contract, not a shortcut.** There is no prompt-preset route
 * on the frozen v1 — verified in docs/48 §3.12, not assumed. The only prompt endpoints are
 * `/admin/ai/prompts*`, which are `ai.manage`-gated and hold the *server-side templates* that define
 * model behaviour. Wiring this page to those would be a different feature (and an admin one), so
 * presets live on the device, as they do on mobile.
 *
 * A preset carries an **instruction** — a user message the writer sends and edits — never a system
 * prompt. Two ways out of this page, because they answer different needs: **Use in assistant** puts
 * the instruction straight into the editor's Ask AI box (the destination every preset was headed for
 * anyway), and **Copy** puts it on the clipboard, which is all mobile can do
 * (`prompt_library_screen.dart:92,116`) and still the right answer when the text is wanted elsewhere.
 * Neither sends anything on the writer's behalf — the assistant is filled, not fired.
 */
export function PromptLibraryPage(): ReactElement {
  usePageTitle('Prompt library');
  const toast = useToast();
  const confirm = useConfirm();

  const customPresets = usePromptLibraryStore((state) => state.customPresets);
  const favoriteIds = usePromptLibraryStore((state) => state.favoriteIds);
  const history = usePromptLibraryStore((state) => state.history);
  const toggleFavorite = usePromptLibraryStore((state) => state.toggleFavorite);
  const addCustomPreset = usePromptLibraryStore((state) => state.addCustomPreset);
  const deleteCustomPreset = usePromptLibraryStore((state) => state.deleteCustomPreset);
  const recordUse = usePromptLibraryStore((state) => state.recordUse);
  const clearHistory = usePromptLibraryStore((state) => state.clearHistory);

  const sendToAssistant = usePromptLibraryStore((state) => state.sendToAssistant);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [instruction, setInstruction] = useState('');

  const presets: PromptPreset[] = [...BUILT_IN_PROMPT_PRESETS, ...customPresets];
  const favorites = presets.filter((preset) => favoriteIds.includes(preset.id));

  const copy = async (text: string): Promise<void> => {
    try {
      // `navigator.clipboard` needs a secure context and can be denied outright, so the failure path
      // is real rather than defensive — and a silent no-op would look like a broken button.
      await navigator.clipboard.writeText(text);
      recordUse(text);
      toast.success('Copied — paste it into the assistant.');
    } catch {
      toast.error('Couldn’t copy', {
        description: 'Your browser blocked clipboard access. Select the text and copy it manually.',
      });
    }
  };

  /**
   * Hand a preset to the editor's assistant instead of the clipboard (W8).
   *
   * The clipboard route (mobile's, and the one below) asks the writer to paste; this one puts the
   * instruction straight into the Ask AI box, which is where every preset was heading anyway. Copy
   * stays for the cases a paste is genuinely wanted — another window, a note, a message.
   */
  const openInAssistant = (text: string): void => {
    sendToAssistant(text);
    void navigate(ROUTES.write);
  };

  const save = (): void => {
    if (instruction.trim() === '') return;
    const created = addCustomPreset({ title, instruction });
    setTitle('');
    setInstruction('');
    toast.success(`Saved “${created.title}”.`);
  };

  const remove = async (preset: PromptPreset): Promise<void> => {
    const ok = await confirm({
      title: `Delete “${preset.title}”?`,
      content: 'This removes it from this device.',
      okText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    deleteCustomPreset(preset.id);
    toast.success('Deleted.');
  };

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-ink mb-1 font-serif text-xl font-semibold">Prompt library</h2>
        <p className="text-ink-secondary text-sm">
          Starting points for the assistant. Send one to the editor, edit it, and run it on your
          selection.
        </p>
        <p className="text-ink-muted mt-1 text-xs">Saved on this device only.</p>
      </section>

      {favorites.length > 0 ? (
        <PresetSection
          heading="Favourites"
          presets={favorites}
          favoriteIds={favoriteIds}
          onCopy={copy}
          onUse={openInAssistant}
          onToggleFavorite={toggleFavorite}
          onDelete={remove}
        />
      ) : null}

      <PresetSection
        heading="Built in"
        presets={[...BUILT_IN_PROMPT_PRESETS]}
        favoriteIds={favoriteIds}
        onCopy={copy}
        onUse={openInAssistant}
        onToggleFavorite={toggleFavorite}
        onDelete={remove}
      />

      <section aria-labelledby="custom-heading" className="flex flex-col gap-3">
        <h3 id="custom-heading" className="text-ink text-base font-semibold">
          Your prompts
        </h3>
        {customPresets.length === 0 ? (
          <p className="text-ink-muted text-sm">
            Nothing saved yet. Add a prompt you find yourself retyping.
          </p>
        ) : (
          <ul aria-label="Your prompts" className="flex flex-col gap-2">
            {customPresets.map((preset) => (
              <PresetRow
                key={preset.id}
                preset={preset}
                isFavorite={favoriteIds.includes(preset.id)}
                onCopy={copy}
                onUse={openInAssistant}
                onToggleFavorite={toggleFavorite}
                onDelete={remove}
              />
            ))}
          </ul>
        )}

        {/*
         * A real `<form>` so Enter submits from either field, with `save` on submit only — not also on
         * the button's click, which would run it twice per click. The form wraps the card rather than
         * being one: `QCard`'s `as` is deliberately limited to div/article/section/li, and widening a
         * shared UI primitive to suit one page is the wrong direction.
         */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <QCard className="flex flex-col gap-3">
            <QInput
              aria-label="Prompt title"
              placeholder="Title (optional)"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <QTextArea
              aria-label="Prompt instruction"
              placeholder="What should the assistant do? e.g. “Tighten this scene without losing the imagery.”"
              rows={3}
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
            />
            <div>
              <QButton htmlType="submit" variant="primary" disabled={instruction.trim() === ''}>
                Save prompt
              </QButton>
            </div>
          </QCard>
        </form>
      </section>

      <section aria-labelledby="history-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="history-heading" className="text-ink text-base font-semibold">
            Recently used
          </h3>
          {history.length > 0 ? (
            <QButton size="sm" onClick={clearHistory}>
              Clear
            </QButton>
          ) : null}
        </div>
        {history.length === 0 ? (
          <p className="text-ink-muted text-sm">Prompts you copy show up here, newest first.</p>
        ) : (
          <ul aria-label="Recently used prompts" className="flex flex-col gap-2">
            {history.map((entry) => (
              <QCard as="li" key={entry} padding="none">
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-ink-secondary min-w-0 flex-1 truncate text-sm">
                    {entry}
                  </span>
                  <QButton
                    size="sm"
                    icon={PenLine}
                    aria-label="Use this prompt in the assistant"
                    onClick={() => openInAssistant(entry)}
                  />
                  <QButton
                    size="sm"
                    icon={Copy}
                    aria-label="Copy this prompt"
                    onClick={() => void copy(entry)}
                  />
                </div>
              </QCard>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PresetSection({
  heading,
  presets,
  favoriteIds,
  onCopy,
  onUse,
  onToggleFavorite,
  onDelete,
}: {
  heading: string;
  presets: PromptPreset[];
  favoriteIds: string[];
  onCopy: (text: string) => Promise<void>;
  onUse: (text: string) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (preset: PromptPreset) => Promise<void>;
}): ReactElement {
  const headingId = `preset-section-${heading.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-ink text-base font-semibold">
        {heading}
      </h3>
      <ul aria-label={heading} className="flex flex-col gap-2">
        {presets.map((preset) => (
          <PresetRow
            key={preset.id}
            preset={preset}
            isFavorite={favoriteIds.includes(preset.id)}
            onCopy={onCopy}
            onUse={onUse}
            onToggleFavorite={onToggleFavorite}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </section>
  );
}

function PresetRow({
  preset,
  isFavorite,
  onCopy,
  onUse,
  onToggleFavorite,
  onDelete,
}: {
  preset: PromptPreset;
  isFavorite: boolean;
  onCopy: (text: string) => Promise<void>;
  onUse: (text: string) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (preset: PromptPreset) => Promise<void>;
}): ReactElement {
  return (
    <QCard as="li" padding="none">
      <div className="flex flex-wrap items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center gap-2">
            <span className="text-ink text-sm font-medium">{preset.title}</span>
            <QTag>{presetKindLabel(preset.kind)}</QTag>
          </div>
          <p className="text-ink-muted text-xs">{preset.description}</p>
          <p className="text-ink-secondary mt-1.5 text-sm">{preset.instruction}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <QButton
            size="sm"
            icon={Star}
            /*
             * `aria-pressed` rather than two different labels: the control is a toggle, and a screen
             * reader announcing "Favourite / pressed" is how a toggle is meant to read. A label that
             * flips between "Favourite" and "Unfavourite" makes the same button sound like two.
             */
            aria-pressed={isFavorite}
            aria-label={`Favourite ${preset.title}`}
            onClick={() => onToggleFavorite(preset.id)}
          />
          <QButton
            size="sm"
            icon={PenLine}
            aria-label={`Use ${preset.title} in the assistant`}
            onClick={() => onUse(preset.instruction)}
          />
          <QButton
            size="sm"
            icon={Copy}
            aria-label={`Copy ${preset.title}`}
            onClick={() => void onCopy(preset.instruction)}
          />
          {preset.isBuiltIn ? null : (
            <QButton
              size="sm"
              variant="danger"
              icon={Trash2}
              aria-label={`Delete ${preset.title}`}
              onClick={() => void onDelete(preset)}
            />
          )}
        </div>
      </div>
    </QCard>
  );
}
