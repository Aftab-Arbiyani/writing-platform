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
  exports: [MediaService],
})
export class MediaModule {}
