import {
  COLLECTION_DESCRIPTION_MAX,
  COLLECTION_NAME_MAX,
  COLLECTION_NAME_MIN,
  Visibility,
} from '@qalam/shared';
import { QButton, QDialog, QInput, QTextArea, useToast } from '@qalam/ui';
import { Checkbox } from 'antd';
import { type ReactElement, useState } from 'react';

import { useCollectionActions } from '@/hooks/use-collections';
import { getErrorMessage } from '@/lib/errors';
import type { Collection } from '@/types/collection';

/**
 * Create or rename a collection (W7b) — one dialog, two modes, mirroring mobile's
 * `collection_form_sheet.dart`.
 *
 * `existing` non-null → rename mode. The dialog resolves with the created/updated collection so a
 * caller can chain, which is what makes "New collection" inside save-to-collection a single gesture
 * (create, then save into it) rather than two trips.
 *
 * **The default "Favorites" collection is never passed here.** `PATCH` rejects a title change on it
 * with `COLLECTION_DEFAULT_IMMUTABLE`, so its callers hide the affordance instead of offering one
 * that gets refused — the same disabled-or-hidden-not-refused rule as W3c-1.
 *
 * Bounds come from `@qalam/shared`, the same constants `CreateCollectionDto` validates with.
 */
export interface CollectionFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** Rename mode when present. */
  existing?: Collection;
  /** Called with the saved collection — lets save-to-collection chain create → save. */
  onSaved?: (collection: Collection) => void;
}

export function CollectionFormDialog({
  open,
  onClose,
  existing,
  onSaved,
}: CollectionFormDialogProps): ReactElement {
  const toast = useToast();
  const { create, update } = useCollectionActions();
  const renaming = existing !== undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [isPrivate, setIsPrivate] = useState(
    existing ? existing.visibility === Visibility.Private : true,
  );

  const trimmedTitle = title.trim();
  const titleTooShort = trimmedTitle.length < COLLECTION_NAME_MIN;
  const titleTooLong = trimmedTitle.length > COLLECTION_NAME_MAX;
  const descriptionTooLong = description.trim().length > COLLECTION_DESCRIPTION_MAX;
  const invalid = titleTooShort || titleTooLong || descriptionTooLong;

  const submit = (): void => {
    if (invalid) return;
    const trimmedDescription = description.trim();
    const payload = {
      title: trimmedTitle,
      ...(trimmedDescription === '' ? {} : { description: trimmedDescription }),
    };

    const settle = {
      onSuccess: (collection: Collection) => {
        toast.success(renaming ? 'Collection updated' : 'Collection created');
        onSaved?.(collection);
        onClose();
      },
      onError: (err: unknown) => {
        toast.error(
          renaming ? 'Couldn’t update the collection' : 'Couldn’t create the collection',
          {
            description: getErrorMessage(err),
          },
        );
      },
    };

    if (renaming) {
      update.mutate({ id: existing.id, ...payload }, settle);
    } else {
      // Private by default — the Phase-1 posture the DTO also defaults to.
      create.mutate(
        { ...payload, visibility: isPrivate ? Visibility.Private : Visibility.Public },
        settle,
      );
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <QDialog
      open={open}
      onClose={onClose}
      title={renaming ? 'Rename collection' : 'New collection'}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <QButton variant="ghost" onClick={onClose}>
            Cancel
          </QButton>
          <QButton loading={isPending} disabled={invalid} onClick={submit}>
            Save
          </QButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <QInput
          label="Name"
          placeholder="Poems to reread"
          value={title}
          autoFocus
          onChange={(event) => setTitle(event.target.value)}
          error={
            titleTooLong ? `Keep it under ${String(COLLECTION_NAME_MAX)} characters.` : undefined
          }
        />
        <QTextArea
          label="Description (optional)"
          value={description}
          rows={3}
          onChange={(event) => setDescription(event.target.value)}
          error={
            descriptionTooLong
              ? `Keep it under ${String(COLLECTION_DESCRIPTION_MAX)} characters.`
              : undefined
          }
        />
        {/* Visibility is create-only: `PATCH` accepts it, but Phase-1 reads are owner-only either
            way, so offering a toggle on rename would imply a sharing model that does not exist yet. */}
        {renaming ? null : (
          <Checkbox checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)}>
            Keep this collection private
          </Checkbox>
        )}
      </div>
    </QDialog>
  );
}
