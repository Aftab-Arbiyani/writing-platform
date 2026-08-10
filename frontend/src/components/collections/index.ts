/**
 * Collections' cross-feature surface (W7b, docs/45 §4.4).
 *
 * App level because saving a piece into a collection is invoked from the reader and from piece
 * cards, while the list and detail pages live in `features/collections` — and a feature may never
 * import another feature (docs/26 §4). The pages compose these; so does the reader.
 */
export { SaveToCollectionDialog } from './save-to-collection-dialog';
export type { SaveToCollectionDialogProps } from './save-to-collection-dialog';
export { CollectionFormDialog } from './collection-form-dialog';
export type { CollectionFormDialogProps } from './collection-form-dialog';
