import { Global, Module } from '@nestjs/common';

import { ImageService } from './image.service';
import { MediaService } from './media.service';
import { MediaStorageService } from './media-storage.service';

/**
 * Media infrastructure — S3 storage + synchronous image processing (docs 13 §7).
 * Global so feature modules (profiles now, pieces later) inject `MediaService`
 * without repeated imports. Exposes the storage abstraction the brief references.
 */
@Global()
@Module({
  providers: [MediaStorageService, ImageService, MediaService],
  // MediaStorageService is exported so the health module can HEAD the bucket
  // for the storage readiness probe (docs 14 §3).
  exports: [MediaService, MediaStorageService],
})
export class MediaModule {}
