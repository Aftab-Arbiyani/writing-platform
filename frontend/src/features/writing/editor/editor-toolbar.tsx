import { cn } from '@qalam/ui';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  Heading4,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState, type KeyboardEvent, type ReactElement } from 'react';

interface Command {
  key: string;
  label: string;
  icon: LucideIcon;
  group: number;
  active?: boolean;
  disabled?: boolean;
  run: () => void;
}

const FALLBACK = {
  bold: false,
  italic: false,
  underline: false,
  paragraph: false,
  h2: false,
  h3: false,
  h4: false,
  bulletList: false,
  orderedList: false,
  blockquote: false,
  alignLeft: false,
  alignCenter: false,
  alignRight: false,
  alignJustify: false,
  canUndo: false,
  canRedo: false,
};

/**
 * Editor formatting toolbar (docs/06 §3.3). A `role="toolbar"` with roving tabindex (one tab
 * stop; ArrowLeft/Right/Home/End move focus; `Esc` returns focus to the text) — the ARIA
 * toolbar pattern (docs/28). Every control maps to a whitelist-legal command
 * (`tiptap-extensions`). Italic is disabled with an explanatory label in Nastaliq/RTL drafts
 * (docs/06 §3.3, §7). Reactive active/undo-redo state via `useEditorState` (no per-keystroke
 * re-render of the document).
 *
 * NOTE (deviation): a persistent sticky toolbar, not the documented floating bubble menu —
 * the bubble menu needs an extra extension + DOM positioning that is brittle under jsdom; the
 * full feature set + a11y are delivered here.
 */
export function EditorToolbar({ editor, isRtl }: { editor: Editor; isRtl: boolean }): ReactElement {
  const state =
    useEditorState({
      editor,
      selector: ({ editor: e }) => ({
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        paragraph: e.isActive('paragraph'),
        h2: e.isActive('heading', { level: 2 }),
        h3: e.isActive('heading', { level: 3 }),
        h4: e.isActive('heading', { level: 4 }),
        bulletList: e.isActive('bulletList'),
        orderedList: e.isActive('orderedList'),
        blockquote: e.isActive('blockquote'),
        alignLeft: e.isActive({ textAlign: 'left' }),
        alignCenter: e.isActive({ textAlign: 'center' }),
        alignRight: e.isActive({ textAlign: 'right' }),
        alignJustify: e.isActive({ textAlign: 'justify' }),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      }),
    }) ?? FALLBACK;

  const chain = () => editor.chain().focus();
  const commands: Command[] = [
    {
      key: 'bold',
      label: 'Bold',
      icon: Bold,
      group: 0,
      active: state.bold,
      run: () => chain().toggleBold().run(),
    },
    {
      key: 'italic',
      label: isRtl ? 'Italic isn’t available in Nastaliq' : 'Italic',
      icon: Italic,
      group: 0,
      active: state.italic,
      disabled: isRtl,
      run: () => chain().toggleItalic().run(),
    },
    {
      key: 'underline',
      label: 'Underline',
      icon: UnderlineIcon,
      group: 0,
      active: state.underline,
      run: () => chain().toggleUnderline().run(),
    },
    {
      key: 'paragraph',
      label: 'Paragraph',
      icon: Pilcrow,
      group: 1,
      active: state.paragraph,
      run: () => chain().setParagraph().run(),
    },
    {
      key: 'h2',
      label: 'Heading 2',
      icon: Heading2,
      group: 1,
      active: state.h2,
      run: () => chain().toggleHeading({ level: 2 }).run(),
    },
    {
      key: 'h3',
      label: 'Heading 3',
      icon: Heading3,
      group: 1,
      active: state.h3,
      run: () => chain().toggleHeading({ level: 3 }).run(),
    },
    {
      key: 'h4',
      label: 'Heading 4',
      icon: Heading4,
      group: 1,
      active: state.h4,
      run: () => chain().toggleHeading({ level: 4 }).run(),
    },
    {
      key: 'ul',
      label: 'Bullet list',
      icon: List,
      group: 2,
      active: state.bulletList,
      run: () => chain().toggleBulletList().run(),
    },
    {
      key: 'ol',
      label: 'Ordered list',
      icon: ListOrdered,
      group: 2,
      active: state.orderedList,
      run: () => chain().toggleOrderedList().run(),
    },
    {
      key: 'quote',
      label: 'Blockquote',
      icon: Quote,
      group: 2,
      active: state.blockquote,
      run: () => chain().toggleBlockquote().run(),
    },
    {
      key: 'left',
      label: 'Align start',
      icon: AlignLeft,
      group: 3,
      active: state.alignLeft,
      run: () => chain().setTextAlign('left').run(),
    },
    {
      key: 'center',
      label: 'Align center',
      icon: AlignCenter,
      group: 3,
      active: state.alignCenter,
      run: () => chain().setTextAlign('center').run(),
    },
    {
      key: 'right',
      label: 'Align end',
      icon: AlignRight,
      group: 3,
      active: state.alignRight,
      run: () => chain().setTextAlign('right').run(),
    },
    {
      key: 'justify',
      label: 'Justify',
      icon: AlignJustify,
      group: 3,
      active: state.alignJustify,
      run: () => chain().setTextAlign('justify').run(),
    },
    {
      key: 'undo',
      label: 'Undo',
      icon: Undo2,
      group: 4,
      disabled: !state.canUndo,
      run: () => chain().undo().run(),
    },
    {
      key: 'redo',
      label: 'Redo',
      icon: Redo2,
      group: 4,
      disabled: !state.canRedo,
      run: () => chain().redo().run(),
    },
  ];

  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focused, setFocused] = useState(0);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      editor.commands.focus();
      return;
    }
    let next = focused;
    if (event.key === 'ArrowRight') next = (focused + 1) % commands.length;
    else if (event.key === 'ArrowLeft') next = (focused - 1 + commands.length) % commands.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = commands.length - 1;
    else return;
    event.preventDefault();
    setFocused(next);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className="border-line flex flex-wrap items-center gap-0.5 rounded-md border bg-surface p-1"
    >
      {commands.map((cmd, index) => {
        const Icon = cmd.icon;
        const showDivider = index > 0 && cmd.group !== commands[index - 1]?.group;
        return (
          <span key={cmd.key} className="flex items-center">
            {showDivider ? <span aria-hidden className="bg-line mx-1 h-5 w-px" /> : null}
            <button
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              title={cmd.label}
              aria-label={cmd.label}
              aria-pressed={cmd.active ?? undefined}
              aria-disabled={cmd.disabled ?? undefined}
              tabIndex={index === focused ? 0 : -1}
              onFocus={() => {
                setFocused(index);
              }}
              onClick={() => {
                if (!cmd.disabled) cmd.run();
              }}
              className={cn(
                'flex size-8 items-center justify-center rounded-sm transition-colors',
                cmd.disabled
                  ? 'cursor-not-allowed text-ink-muted opacity-50'
                  : cmd.active
                    ? 'bg-accent/12 text-accent-on-tint'
                    : 'text-ink-secondary hover:bg-raised hover:text-ink',
              )}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden />
            </button>
          </span>
        );
      })}
    </div>
  );
}
