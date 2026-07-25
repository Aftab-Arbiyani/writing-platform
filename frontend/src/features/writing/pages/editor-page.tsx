import { QButton, QErrorState, QSelect, QSpinner } from '@qalam/ui';
import { EditorContent, useEditor } from '@tiptap/react';
import { ArrowLeft, Eye, MoreHorizontal, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage } from '@/lib/errors';
import { ROUTES } from '@/lib/routes';

import { EditorMetrics } from '../editor/editor-metrics';
import { EditorToolbar } from '../editor/editor-toolbar';
import { buildEditorExtensions } from '../editor/tiptap-extensions';
import { useDraftAutosave, type DraftSnapshot } from '../hooks/use-draft-autosave';
import { usePiece } from '../hooks/use-piece';
import { usePreviewPiece } from '../hooks/use-piece-mutations';
import { useLanguages } from '../hooks/use-taxonomy';
import { useEditorUiStore } from '../stores/editor-ui.store';
import type { Piece, TipTapDoc } from '../types/piece.types';
import { PublishSheet } from '../components/publish-sheet';
import { PreviewView } from '../components/preview-view';
import { SaveStatusIndicator } from '../components/save-status-indicator';

const EMPTY_DOC: TipTapDoc = { type: 'doc', content: [] };

/**
 * The editor (docs/06 §3.3) — distraction-free. TipTap owns the document (docs/12 §5); title +
 * language are local state. Every change schedules a debounced autosave (create-then-PATCH). A
 * brand-new `/write` becomes `/write/:id` after the first save. Preview + Publish flush first,
 * then hit the server-canonical endpoints. TipTap is lazy-loaded (this route is a lazy chunk).
 */
export function EditorPage(): ReactElement {
  usePageTitle('Write');
  const params = useParams();
  const draftId = params.draftId;
  const navigate = useNavigate();

  const piece = usePiece(draftId);
  const languages = useLanguages();
  const preview = usePreviewPiece();
  const setPublishOpen = useEditorUiStore((s) => s.setPublishOpen);
  const publishOpen = useEditorUiStore((s) => s.publishOpen);

  const [title, setTitle] = useState('');
  const [languageCode, setLanguageCode] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [previewedPiece, setPreviewedPiece] = useState<Piece | null>(null);

  const autosaveRef = useRef<{ scheduleSave: () => void } | null>(null);

  const editor = useEditor(
    {
      extensions: buildEditorExtensions(),
      content: EMPTY_DOC,
      editorProps: {
        attributes: {
          class: 'qalam-prose min-h-[50vh] focus:outline-none',
          // A contenteditable div has no implicit ARIA role, so `aria-label` alone is a
          // prohibited-attribute a11y violation. `role="textbox"` + `aria-multiline` give the
          // rich-text surface a valid, screen-reader-announceable role for the label.
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': 'Story content',
        },
      },
      onUpdate: () => {
        autosaveRef.current?.scheduleSave();
      },
    },
    [],
  );

  const getSnapshot = useCallback(
    (): DraftSnapshot => ({
      languageCode,
      title,
      content: (editor?.getJSON() ?? EMPTY_DOC) as TipTapDoc,
    }),
    [languageCode, title, editor],
  );

  const onCreated = useCallback(
    (id: string) => {
      void navigate(`${ROUTES.write}/${id}`, { replace: true });
    },
    [navigate],
  );

  const autosave = useDraftAutosave({ pieceId: draftId, getSnapshot, onCreated });
  autosaveRef.current = autosave;

  // Hydrate once: existing draft → fill title/language + TipTap; new draft → nothing to load.
  useEffect(() => {
    if (hydrated || !editor) return;
    if (!draftId) {
      setHydrated(true);
      return;
    }
    if (piece.data) {
      setTitle(piece.data.title);
      setLanguageCode(piece.data.language?.code ?? '');
      editor.commands.setContent(piece.data.content);
      setHydrated(true);
    }
  }, [hydrated, editor, draftId, piece.data]);

  // Default the language for a fresh draft once the option list is available.
  useEffect(() => {
    if (hydrated && languageCode === '' && languages.data && languages.data.length > 0) {
      setLanguageCode(languages.data[0]?.code ?? '');
    }
  }, [hydrated, languageCode, languages.data]);

  // Warn on tab close with unsaved changes (docs/12 §5.1).
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent): void => {
      if (useEditorUiStore.getState().isDirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, []);

  useEffect(
    () => () => {
      useEditorUiStore.getState().reset();
    },
    [],
  );

  const direction = languages.data?.find((l) => l.code === languageCode)?.direction ?? 'ltr';
  const isRtl = direction === 'rtl';

  const openPreview = async (): Promise<void> => {
    const id = await autosave.flush();
    if (!id) return;
    try {
      setPreviewedPiece(await preview.mutateAsync(id));
    } catch {
      /* preview failure is non-critical; the button simply does nothing visible */
    }
  };

  const openPublish = async (): Promise<void> => {
    const id = await autosave.flush();
    if (!id) return;
    setPublishOpen(true);
  };

  const loading = Boolean(draftId) && piece.isLoading;
  const failed = Boolean(draftId) && piece.isError;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 py-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <QButton
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
          onClick={() => {
            void autosave.flush();
            void navigate(ROUTES.drafts);
          }}
        >
          Drafts
        </QButton>
        <SaveStatusIndicator />
        <div className="flex items-center gap-2">
          <div className="w-32">
            <QSelect
              aria-label="Language"
              placeholder="Language"
              size="md"
              loading={languages.isLoading}
              value={languageCode || undefined}
              onChange={(value) => {
                if (typeof value === 'string') {
                  setLanguageCode(value);
                  autosave.scheduleSave();
                }
              }}
              options={(languages.data ?? []).map((l) => ({ value: l.code, label: l.nativeName }))}
            />
          </div>
          <QButton
            variant="ghost"
            size="sm"
            icon={MoreHorizontal}
            aria-label={showMetrics ? 'Hide word count' : 'Show word count'}
            aria-pressed={showMetrics}
            onClick={() => {
              setShowMetrics((v) => !v);
            }}
          />
          <QButton
            variant="secondary"
            size="sm"
            icon={Eye}
            loading={preview.isPending}
            onClick={() => {
              void openPreview();
            }}
          >
            Preview
          </QButton>
          <QButton
            variant="primary"
            size="sm"
            icon={Send}
            onClick={() => {
              void openPublish();
            }}
          >
            Publish
          </QButton>
        </div>
      </header>

      {failed ? (
        <QErrorState
          title="Couldn’t load this draft."
          description={getErrorMessage(piece.error)}
          onRetry={() => {
            void piece.refetch();
          }}
        />
      ) : loading || !editor ? (
        <div className="flex justify-center py-16" role="status" aria-label="Loading editor">
          <QSpinner />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <input
            value={title}
            dir={direction}
            onChange={(e) => {
              setTitle(e.target.value);
              autosave.scheduleSave();
            }}
            placeholder="Title"
            aria-label="Title"
            className="w-full bg-transparent font-serif text-3xl font-semibold text-ink placeholder:text-ink-muted focus:outline-none"
          />
          <div className="sticky top-14 z-10 bg-canvas/95 py-1 backdrop-blur sm:top-16">
            <EditorToolbar editor={editor} isRtl={isRtl} />
          </div>
          <div dir={direction}>
            <EditorContent editor={editor} />
          </div>
          {showMetrics ? (
            <div className="flex justify-end border-t border-line pt-2">
              <EditorMetrics editor={editor} />
            </div>
          ) : null}
        </div>
      )}

      {previewedPiece ? (
        <PreviewView
          piece={previewedPiece}
          onClose={() => {
            setPreviewedPiece(null);
          }}
          onPublish={() => {
            setPreviewedPiece(null);
            void openPublish();
          }}
        />
      ) : null}

      {publishOpen && piece.data ? (
        <PublishSheet
          piece={piece.data}
          onClose={() => {
            setPublishOpen(false);
          }}
          onDone={(_result, scheduled) => {
            setPublishOpen(false);
            void navigate(
              scheduled ? `${ROUTES.drafts}?status=scheduled` : `${ROUTES.drafts}?status=published`,
            );
          }}
        />
      ) : null}
    </div>
  );
}
