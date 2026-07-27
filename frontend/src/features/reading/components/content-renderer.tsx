import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { Fragment } from 'react';

import { useNastaliqFont } from '../hooks/use-nastaliq-font';
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

function renderChildren(node: TipTapNode): ReactNode {
  return (node.content ?? []).map((child, index) => (
    // TipTap documents have no stable per-node ids, and the array is positional and only
    // re-rendered wholesale when the piece changes — index keys are correct here.
    <Fragment key={index}>{renderNode(child)}</Fragment>
  ));
}

function renderNode(node: TipTapNode): ReactNode {
  switch (node.type) {
    case 'text':
      return applyMarks(node.text ?? '', node.marks);

    case 'paragraph':
      return <p style={alignStyle(node)}>{renderChildren(node)}</p>;

    case 'heading': {
      const level = node.attrs?.level;
      const Tag = HEADING_TAGS[level as 2 | 3 | 4] ?? 'h2';
      return <Tag style={alignStyle(node)}>{renderChildren(node)}</Tag>;
    }

    case 'blockquote':
      return <blockquote>{renderChildren(node)}</blockquote>;

    case 'bulletList':
      return <ul>{renderChildren(node)}</ul>;

    case 'orderedList': {
      const start = node.attrs?.start;
      return <ol start={typeof start === 'number' ? start : undefined}>{renderChildren(node)}</ol>;
    }

    case 'listItem':
      return <li>{renderChildren(node)}</li>;

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
      return renderChildren(node);

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
      {renderNode(content)}
    </div>
  );
}
