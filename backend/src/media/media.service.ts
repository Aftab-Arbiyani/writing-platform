import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { JOB_ENQUEUER, type JobEnqueuer } from '../common/queue/job-enqueuer.port';
import { JOB } from '../common/queue/queue.constants';
import { ImageService } from './image.service';
import type { ImageKind, ImageMetadata, UploadedImage } from './image.service';
import { MediaStorageService } from './media-storage.service';

/** Result of the background media pass (thumbnail + extracted metadata). */
export interface MediaProcessingResult {
  sourceKey: string;
  thumbnailKey: string;
  metadata: ImageMetadata;
}

/**
 * Media facade for profile images (docs 13 §7). The primary re-encode still runs
 * synchronously so the stored image is immediately usable (and EXIF is stripped
 * on the request path — a security property, docs 13 §7). The *expensive derived
 * work* — thumbnail generation + metadata extraction — is offloaded to the
 * `media-processing` worker (Epic 11): after a successful upload, a job is
 * enqueued best-effort (a queue outage never fails the upload). Profiles store
 * keys, never full URLs (docs 04 §3.1).
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly images: ImageService,
    private readonly storage: MediaStorageService,
    @Optional() @Inject(JOB_ENQUEUER) private readonly jobs?: JobEnqueuer,
  ) {}

  async uploadProfileImage(userId: string, kind: ImageKind, file: UploadedImage): Promise<string> {
    const { buffer, contentType } = await this.images.process(kind, file);
    const key = `profiles/${userId}/${kind}-${uuidv7()}.webp`;
    await this.storage.put(key, buffer, contentType);
    await this.enqueueBackgroundProcessing(key, kind);
    return key;
  }

  /** Piece cover (reuses the cover image pipeline; E4). Key is `pieces/{pieceId}/…`. */
  async uploadPieceCover(pieceId: string, file: UploadedImage): Promise<string> {
    const { buffer, contentType } = await this.images.process('cover', file);
    const key = `pieces/${pieceId}/cover-${uuidv7()}.webp`;
    await this.storage.put(key, buffer, contentType);
    await this.enqueueBackgroundProcessing(key, 'cover');
    return key;
  }

  /**
   * Background media pass (media worker): download the stored original, generate
   * a thumbnail rendition, extract metadata. Reuses {@link ImageService} — no
   * image logic is duplicated. Watermarking is a documented future extension
   * (docs 13 §7) — the seam is here.
   */
  async processInBackground(key: string, _kind: ImageKind): Promise<MediaProcessingResult> {
    const original = await this.storage.get(key);
    const [thumb, metadata] = await Promise.all([
      this.images.generateThumbnail(original),
      this.images.extractMetadata(original),
    ]);
    const thumbnailKey = key.replace(/\.webp$/, '-thumb.webp');
    await this.storage.put(thumbnailKey, thumb.buffer, thumb.contentType);
    return { sourceKey: key, thumbnailKey, metadata };
  }

  /** Best-effort removal of a superseded object (never blocks the request). */
  async deleteQuietly(key: string | null): Promise<void> {
    if (key === null) {
      return;
    }
    await this.storage.delete(key).catch(() => undefined);
  }

  private async enqueueBackgroundProcessing(key: string, kind: ImageKind): Promise<void> {
    if (this.jobs === undefined) {
      return;
    }
    try {
      await this.jobs.enqueue(JOB.MediaOptimize, { key, kind });
    } catch (error) {
      this.logger.warn(
        `failed to enqueue media processing for ${key}: ${(error as Error).message}`,
      );
    }
  }
}
