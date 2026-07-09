import { describe, expect, it } from 'vitest';

import { validateCoverImage } from './image-validation';

function fileOf(type: string, sizeBytes: number): File {
  const file = new File(['x'], 'cover', { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

describe('validateCoverImage', () => {
  it('accepts JPEG/PNG/WebP within the size cap', () => {
    expect(validateCoverImage(fileOf('image/jpeg', 1_000))).toBeNull();
    expect(validateCoverImage(fileOf('image/png', 1_000))).toBeNull();
    expect(validateCoverImage(fileOf('image/webp', 1_000))).toBeNull();
  });

  it('rejects an unsupported type', () => {
    expect(validateCoverImage(fileOf('image/gif', 1_000))).toBe('MEDIA_TYPE_UNSUPPORTED');
    expect(validateCoverImage(fileOf('application/pdf', 1_000))).toBe('MEDIA_TYPE_UNSUPPORTED');
  });

  it('rejects an image over the 15MB cap', () => {
    expect(validateCoverImage(fileOf('image/jpeg', 16 * 1024 * 1024))).toBe('MEDIA_TOO_LARGE');
  });
});
