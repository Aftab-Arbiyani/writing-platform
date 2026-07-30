import { useCallback, useEffect, useRef } from 'react';

import { ApiError } from '@/lib/api-client';

import { useEditorUiStore } from '../stores/editor-ui.store';
import type { CreatePiecePayload, TipTapDoc } from '../types/piece.types';
import { useCreatePiece, useUpdatePiece } from './use-piece-mutations';

/** Debounce for the trailing autosave (docs/12 §5.1). */
const AUTOSAVE_DEBOUNCE_MS = 2000;

/**
 * The editor's editable snapshot. The editor owns ONLY title + language + content; subtitle,
 * featured quote, genre, tags, and visibility are the publish sheet's (saved at publish), so
 * autosave never touches them — otherwise a debounced PATCH would clobber sheet-set metadata.
 */
export interface DraftSnapshot {
  languageCode: string;
  title: string;
  content: TipTapDoc;
}

function isOfflineError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 0 || error.code === 'API_OFFLINE' || error.code === 'API_TIMEOUT')
  );
}

interface UseDraftAutosaveArgs {
  pieceId: string | undefined;
  /** Reads the current editor snapshot on demand — never per keystroke (docs/12 §5). */
  getSnapshot: () => DraftSnapshot;
  /** Called with the new id after a brand-new draft is created (page swaps URL → /write/:id). */
  onCreated: (id: string) => void;
}

/**
 * Autosave orchestrator (docs/12 §5.1). A change schedules a trailing save; the save reads the
 * live snapshot and CREATES the draft (needs a language) if there's no id yet, else PATCHes.
 * Only one save is in flight at a time — a change during a save marks the run "pending" and a
 * fresh save fires when it settles (latest snapshot wins; never double-creates). Status flows
 * into the editor-ui store (saving → saved / offline-error).
 */
export function useDraftAutosave({ pieceId, getSnapshot, onCreated }: UseDraftAutosaveArgs) {
  const create = useCreatePiece();
  const update = useUpdatePiece();

  const idRef = useRef<string | undefined>(pieceId);
  const snapshotRef = useRef(getSnapshot);
  const onCreatedRef = useRef(onCreated);
  const createRef = useRef(create);
  const updateRef = useRef(update);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  snapshotRef.current = getSnapshot;
  onCreatedRef.current = onCreated;
  createRef.current = create;
  updateRef.current = update;
  useEffect(() => {
    if (pieceId) idRef.current = pieceId;
  }, [pieceId]);

  const flush = useCallback(async function flush(): Promise<string | undefined> {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (savingRef.current) {
      pendingRef.current = true;
      return idRef.current;
    }
    const snap = snapshotRef.current();
    // A brand-new draft cannot be created without a language — wait for one.
    if (!idRef.current && !snap.languageCode) return undefined;

    savingRef.current = true;
    useEditorUiStore.getState().markSaving();
    try {
      if (!idRef.current) {
        const payload: CreatePiecePayload = {
          languageCode: snap.languageCode,
          title: snap.title,
          content: snap.content,
        };
        const created = await createRef.current.mutateAsync(payload);
        idRef.current = created.id;
        onCreatedRef.current(created.id);
      } else {
        await updateRef.current.mutateAsync({
          id: idRef.current,
          patch: { title: snap.title, content: snap.content, languageCode: snap.languageCode },
        });
      }
      useEditorUiStore.getState().markSaved(Date.now());
    } catch (error) {
      useEditorUiStore.getState().markError(isOfflineError(error));
    } finally {
      savingRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        void flush();
      }
    }
    return idRef.current;
  }, []);

  const scheduleSave = useCallback(() => {
    useEditorUiStore.getState().markDirty();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void flush();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [flush]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { scheduleSave, flush };
}
