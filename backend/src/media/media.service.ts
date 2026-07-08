import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { ImageService } from './image.service';
import type { ImageKind, UploadedImage } from './image.service';
import { MediaStorageService } from './media-storage.service';

/**
 * Media facade for profile images (docs 13 §7). Processes synchronously, then
 * stores under a server-generated key; returns the key (profiles store keys,
 * never full URLs — docs 04 §3.1). Best-effort delete of a replaced object.
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly images: ImageService,
    private readonly storage: MediaStorageService,
  ) {}

  async uploadProfileImage(userId: string, kind: ImageKind, file: UploadedImage): Promise<string> {
    const { buffer, contentType } = await this.images.process(kind, file);
    const key = `profiles/${userId}/${kind}-${uuidv7()}.webp`;
    await this.storage.put(key, buffer, contentType);
    return key;
  }

  /** Piece cover (reuses the cover image pipeline; E4). Key is `pieces/{pieceId}/…`. */
  async uploadPieceCover(pieceId: string, file: UploadedImage): Promise<string> {
    const { buffer, contentType } = await this.images.process('cover', file);
    const key = `pieces/${pieceId}/cover-${uuidv7()}.webp`;
    await this.storage.put(key, buffer, contentType);
    return key;
  }

  /** Best-effort removal of a superseded object (never blocks the request). */
  async deleteQuietly(key: string | null): Promise<void> {
    if (key === null) {
      return;
    }
    await this.storage.delete(key).catch(() => undefined);
  }
}
