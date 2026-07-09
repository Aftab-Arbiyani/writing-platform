import { QAvatar, QButton } from '@qalam/ui';
import { Monitor, Smartphone, X } from 'lucide-react';
import { useEffect, type ReactElement } from 'react';

import { formatReadingTime } from '@/lib/format';
import { mediaUrl } from '@/lib/media';

import { useEditorUiStore } from '../stores/editor-ui.store';
import type { Piece } from '../types/piece.types';
import { PieceContentView } from './piece-content-view';

/**
 * Full-page preview (docs/06 §3.4) — "exactly the reading view" with a "Previewing" banner and
 * a desktop/mobile device toggle. Renders the server-canonical piece (from `POST
 * /pieces/:id/preview`) read-only. Esc closes; `aria-modal` overlay above all chrome.
 */
export function PreviewView({
  piece,
  onClose,
  onPublish,
}: {
  piece: Piece;
  onClose: () => void;
  onPublish: () => void;
}): ReactElement {
  const mode = useEditorUiStore((s) => s.previewMode);
  const setMode = useEditorUiStore((s) => s.setPreviewMode);
  const direction = piece.language?.direction;
  const displayName = piece.author.penName ?? `@${piece.author.username}`;
  const cover = mediaUrl(piece.coverImageKey);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Preview"
      className="fixed inset-0 z-[1100] flex flex-col bg-canvas"
    >
      <div className="border-line flex items-center justify-between gap-3 border-b px-4 py-3">
        <p className="text-sm text-ink-secondary">Previewing — readers will see this</p>
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Preview device"
            className="hidden items-center gap-1 sm:flex"
          >
            <QButton
              variant={mode === 'desktop' ? 'secondary' : 'ghost'}
              size="sm"
              icon={Monitor}
              aria-label="Desktop preview"
              onClick={() => {
                setMode('desktop');
              }}
            />
            <QButton
              variant={mode === 'mobile' ? 'secondary' : 'ghost'}
              size="sm"
              icon={Smartphone}
              aria-label="Mobile preview"
              onClick={() => {
                setMode('mobile');
              }}
            />
          </div>
          <QButton variant="secondary" size="sm" onClick={onClose}>
            Back
          </QButton>
          <QButton variant="primary" size="sm" onClick={onPublish}>
            Publish
          </QButton>
          <QButton
            variant="ghost"
            size="sm"
            icon={X}
            aria-label="Close preview"
            onClick={onClose}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-8">
        <article
          className={
            mode === 'mobile'
              ? 'mx-auto w-[390px] max-w-full px-4'
              : 'mx-auto w-full max-w-[68ch] px-4 sm:px-6'
          }
        >
          {cover ? (
            <img src={cover} alt="" className="mb-6 aspect-[2/1] w-full rounded-md object-cover" />
          ) : null}
          <h1 dir={direction} className="font-serif text-4xl font-semibold leading-tight text-ink">
            {piece.title || 'Untitled'}
          </h1>
          {piece.subtitle ? (
            <p dir={direction} className="mt-2 text-xl text-ink-secondary">
              {piece.subtitle}
            </p>
          ) : null}
          <div className="mt-4 flex items-center gap-2 text-sm text-ink-secondary">
            <QAvatar size={32} name={displayName} />
            <span className="font-medium text-ink">{displayName}</span>
            <span aria-hidden>·</span>
            <span>{formatReadingTime(piece.readingTimeSeconds)} read</span>
          </div>
          <hr className="border-line my-6" />
          {piece.featuredQuote ? (
            <blockquote
              dir={direction}
              className="border-accent mb-6 border-s-2 ps-4 font-serif text-2xl italic text-ink-secondary"
            >
              {piece.featuredQuote}
            </blockquote>
          ) : null}
          <PieceContentView content={piece.content} direction={direction} />
        </article>
      </div>
    </div>
  );
}
