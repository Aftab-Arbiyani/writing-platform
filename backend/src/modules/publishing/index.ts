/**
 * Public surface of the publishing module (AF6) — one barrel per backend module
 * (docs 16 §5.2). Consumers import {@link PublishingModule} to wire it and
 * {@link PublishingService} for the editorial publish/unpublish/schedule/
 * visibility/history API.
 */
export { PublishingModule } from './publishing.module';
export { PublishingService } from './publishing.service';
export { ReviewService } from './review.service';
export { SnapshotService } from './snapshot.service';
