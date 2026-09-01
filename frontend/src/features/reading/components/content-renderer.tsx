import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { Fragment } from 'react';

import { useNastaliqFont } from '../hooks/use-nastaliq-font';
import type { BlockAnchor } from '../lib/content-anchors';
import { readerStyle, useReaderPreferences } from '../stores/reader-preferences.store';
import type { TipTapNode } from '../types/reading.types';

/**
 * Renders the canonical TipTap document the API serves (W1, docs/45 §4.1).
 *
 * **Why this is hand-written rather than `generateHTML` + `dangerouslySetInnerHTML`:** the API
 * deliberately never serves HTML (docs 13 §5.2), and round-tripping JSON through an HTML string
 * would re-introduce exactly the injection surface that decision removes. Every node below is
 * constructed as a React element, so author content can never become markup.
 *
 * The supported set mirrors the **server's** whitelist exactly
 * (`backend/src/modules/pieces/content/content-sanitizer.ts`): paragraph, heading (2–4),
 * blockquote, bulletList / orderedList / listItem, hardBreak, footnote, mention, hashtag; marks
 * bold / italic / underline; `textAlign` on paragraphs and headings. There is deliberately **no
 * `link` mark** — it is not in the editor and is the most XSS-prone. An unknown node type is
 * skipped rather than guessed at: the sanitizer rejects unknown types on write, so encountering
 * one here means a schema change shipped without updating this renderer, and silently dropping
 * it is safer than rendering something unintended.
 *
 * Visual styling lives on the shared `.qalam-prose` class (`styles/global.css`), which the
 * editor uses too — so what a writer composes is what a reader gets.
 */

const HEADING_TAGS = { 2: 'h2', 3: 'h3', 4: 'h4' } as const;
const ALLOWED_ALIGN = new Set(['left', 'right', 'center', 'justify']);

function alignStyle(node: TipTapNode): CSSProperties | undefined {
  const align = node.attrs?.textAlign;
  return typeof align === 'string' && ALLOWED_ALIGN.has(align)
    ? { textAlign: align as CSSProperties['textAlign'] }
    : undefined;
}

/** Wrap a text leaf in its marks, innermost-first. Unknown marks are ignored, never rendered. */
function applyMarks(text: string, marks: TipTapNode['marks']): ReactNode {
  let out: ReactNode = text;
  for (const mark of marks ?? []) {
    if (mark.type === 'bold') out = <strong>{out}</strong>;
    else if (mark.type === 'italic') out = <em>{out}</em>;
    else if (mark.type === 'underline') out = <u>{out}</u>;
  }
  return out;
}

/**
 * Optional per-render selection state (C-15). Threaded as an argument rather than read from a
 * store so `renderNode` stays a pure function of its inputs and the renderer keeps working
 * unchanged — and identically — on every surface that does not offer selection.
 */
interface SelectionCtx {
  anchors: Map<TipTapNode, BlockAnchor>;
  onSelect: (anchor: BlockAnchor) => void;
}

function renderChildren(node: TipTapNode, ctx?: SelectionCtx): ReactNode {
  return (node.content ?? []).map((child, index) => (
    // TipTap documents have no stable per-node ids, and the array is positional and only
    // re-rendered wholesale when the piece changes — index keys are correct here.
    <Fragment key={index}>{renderNode(child, ctx)}</Fragment>
  ));
}

/**
 * Wraps a selectable block in a real `<button>` (C-15).
 *
 * A button rather than a click handler on the `<p>`: this is an interactive control, so it must be
 * focusable, Enter/Space-operable and announced as such. `text-start`/`w-full` keep the prose
 * laying out exactly as it does when selection is off, and `display: contents` is deliberately NOT
 * used — it would drop the button from the a11y tree in some engines, which is the whole point of
 * using one.
 */
function selectable(node: TipTapNode, ctx: SelectionCtx, child: ReactNode): ReactNode {
  const anchor = ctx.anchors.get(node);
  if (anchor === undefined) return child;
  return (
    <button
      type="button"
      onClick={() => ctx.onSelect(anchor)}
      aria-label={`Suggest an edit to this passage: ${anchor.text.slice(0, 80)}`}
      className="hover:bg-raised focus-visible:outline-accent w-full cursor-pointer rounded-md text-start focus-visible:outline-2"
    >
      {child}
    </button>
  );
}

function renderNode(node: TipTapNode, ctx?: SelectionCtx): ReactNode {
  if (ctx !== undefined && (node.type === 'paragraph' || node.type === 'heading')) {
    return selectable(node, ctx, renderBlock(node, ctx));
  }
  return renderBlock(node, ctx);
}

function renderBlock(node: TipTapNode, ctx?: SelectionCtx): ReactNode {
  switch (node.type) {
    case 'text':
      return applyMarks(node.text ?? '', node.marks);

    case 'paragraph':
      return <p style={alignStyle(node)}>{renderChildren(node, ctx)}</p>;

    case 'heading': {
      const level = node.attrs?.level;
      const Tag = HEADING_TAGS[level as 2 | 3 | 4] ?? 'h2';
      return <Tag style={alignStyle(node)}>{renderChildren(node, ctx)}</Tag>;
    }

    case 'blockquote':
      return <blockquote>{renderChildren(node, ctx)}</blockquote>;

    case 'bulletList':
      return <ul>{renderChildren(node, ctx)}</ul>;

    case 'orderedList': {
      const start = node.attrs?.start;
      return (
        <ol start={typeof start === 'number' ? start : undefined}>{renderChildren(node, ctx)}</ol>
      );
    }

    case 'listItem':
      return <li>{renderChildren(node, ctx)}</li>;

    case 'hardBreak':
      return <br />;

    case 'footnote': {
      const id = node.attrs?.id;
      return (
        <sup className="text-ink-muted">
          <a href={`#fn-${String(id)}`} id={`fnref-${String(id)}`}>
            {String(id)}
          </a>
        </sup>
      );
    }

    case 'mention': {
      // `label` is the display text the author saw; link by username so the target is stable.
      const label = node.attrs?.label;
      const userId = node.attrs?.userId;
      const text = typeof label === 'string' ? label : String(userId ?? '');
      return <span className="text-accent">@{text}</span>;
    }

    case 'hashtag': {
      const tag = node.attrs?.tag;
      return <span className="text-accent">#{String(tag ?? '')}</span>;
    }

    case 'doc':
      return renderChildren(node, ctx);

    default:
      return null;
  }
}

export interface ContentRendererProps {
  content: TipTapNode;
  /** `rtl` for Urdu/Nastaliq etc. — flows from the piece's language (docs/07 typography). */
  dir?: 'ltr' | 'rtl';
  /** Nastaliq is vertically demanding and is floored at 2.0 leading (docs/06 §7). */
  script?: string | null;
  /**
   * Per-block anchors (C-15). When supplied **together with** `onBlockSelect`, every paragraph or
   * heading that has an entry becomes a focusable control that reports its anchor when activated.
   * Mirrors mobile's `ContentRenderer.blockAnchors` / `onBlockTap` pair.
   *
   * Build it with [`buildBlockAnchors`](../lib/content-anchors.ts) over **the same `content` object
   * passed here** — the map is keyed by node identity, so a separately-parsed copy of the document
   * will match nothing and silently render no controls at all.
   *
   * Omit both (the default on every other surface) and this component behaves exactly as before.
   */
  blockAnchors?: Map<TipTapNode, BlockAnchor>;
  onBlockSelect?: (anchor: BlockAnchor) => void;
}

/**
 * The prose column. Size and leading come from the reader's own preferences
 * ([`reader-preferences.store`](../stores/reader-preferences.store.ts)) and are applied as the
 * two CSS variables `.qalam-prose` indirects through, so the editor — which never sets them —
 * is unaffected. Nastaliq clamps the leading up to its floor regardless of the preference.
 */
export function ContentRenderer({
  content,
  dir = 'ltr',
  script,
  blockAnchors,
  onBlockSelect,
}: ContentRendererProps): ReactElement {
  const textSize = useReaderPreferences((s) => s.textSize);
  const lineSpacing = useReaderPreferences((s) => s.lineSpacing);
  const width = useReaderPreferences((s) => s.width);
  const { fontSize, lineHeight } = readerStyle({ textSize, lineSpacing, width }, script);
  useNastaliqFont(script);

  return (
    <div
      dir={dir}
      className="qalam-prose"
      style={
        {
          '--q-prose-size': fontSize,
          '--q-prose-leading': lineHeight,
        } as CSSProperties
      }
    >
      {/* Selection is offered only when BOTH halves are present — a map with no handler would
          render controls that do nothing, and a handler with no map would never fire. */}
      {renderNode(
        content,
        blockAnchors !== undefined && onBlockSelect !== undefined
          ? { anchors: blockAnchors, onSelect: onBlockSelect }
          : undefined,
      )}
    </div>
  );
}
