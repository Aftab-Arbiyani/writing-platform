/**
 * Public surface of the collections feature (docs/26 §4) — the two owner-only routes W7b adds
 * (`/me/collections`, `/me/collections/:collectionId`), imported by their lazy route modules.
 *
 * The feature owns only its pages. The data layer (`hooks/use-collections`) and the two dialogs
 * (`components/collections`) sit at APP level, because saving a piece into a collection is invoked
 * from the reader and from piece cards — and a feature may never import another feature. So this
 * feature is deletable with one `rm -rf` without taking save-to-collection with it.
 */
export { CollectionsPage } from './pages/collections-page';
export { CollectionDetailPage } from './pages/collection-detail-page';
