import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ACCEPTED_IMAGE_TYPES,
  AVATAR_IMAGE_MAX_MB,
  COVER_IMAGE_MAX_MB,
  ERROR_CODES,
} from '@qalam/shared';
import sharp from 'sharp';

import { AppException } from '../common/exceptions/app.exception';

export type ImageKind = 'avatar' | 'cover';

/** Raw uploaded file (Multer memory storage). */
export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/** Output dimensions per kind (docs 13 §7 — re-encode to WebP, metadata stripped). */
const SPEC: Record<ImageKind, { maxMb: number; width: number; height: number }> = {
  avatar: { maxMb: AVATAR_IMAGE_MAX_MB, width: 512, height: 512 },
  cover: { maxMb: COVER_IMAGE_MAX_MB, width: 1500, height: 500 },
};

class MediaTypeException extends AppException {
  constructor() {
    super(
      ERROR_CODES.MEDIA_TYPE_UNSUPPORTED,
      'Only JPEG, PNG, or WebP images are accepted.',
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    );
  }
}
class MediaTooLargeException extends AppException {
  constructor(maxMb: number) {
    super(
      ERROR_CODES.MEDIA_TOO_LARGE,
      `Image exceeds the ${maxMb} MB limit.`,
      HttpStatus.PAYLOAD_TOO_LARGE,
    );
  }
}

/**
 * Validates and re-encodes profile images synchronously (docs 13 §7). No
 * background job (excluded this epic): the async pre-signed + media-processing
 * worker flow is the production target when jobs are enabled — the re-encode
 * logic here moves into that worker unchanged.
 *
 * Defense: declared mime-type allowlist + size cap, then sharp decodes the bytes
 * (rejecting anything that isn't a real image — magic-byte check by decode) and
 * re-encodes to WebP, which strips all EXIF/GPS/ICC metadata and any polyglot
 * payload (only pixels survive).
 */
@Injectable()
export class ImageService {
  async process(
    kind: ImageKind,
    file: UploadedImage,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const spec = SPEC[kind];

    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new MediaTypeException();
    }
    if (file.size > spec.maxMb * 1024 * 1024) {
      throw new MediaTooLargeException(spec.maxMb);
    }

    try {
      const pipeline = sharp(file.buffer, { limitInputPixels: 12_000 * 12_000 });
      const meta = await pipeline.metadata();
      if (meta.format === undefined || !['jpeg', 'png', 'webp'].includes(meta.format)) {
        throw new MediaTypeException();
      }
      const buffer = await pipeline
        .rotate() // honor EXIF orientation before it's stripped
        .resize(spec.width, spec.height, {
          fit: kind === 'avatar' ? 'cover' : 'cover',
          position: 'centre',
        })
        .webp({ quality: 82 })
        .toBuffer();
      return { buffer, contentType: 'image/webp' };
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }
      throw new MediaTypeException(); // sharp failed to decode → not a valid image
    }
  }
}
