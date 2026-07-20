/**
 * Object-storage config namespace — S3-compatible (MinIO in dev, S3/R2 in
 * prod). Consumed by the Phase-1 media module (pre-signed uploads; the API
 * never proxies file bytes). Consumers inject ConfigType<typeof storageConfig>.
 */
import { registerAs } from '@nestjs/config';

export const storageConfig = registerAs('storage', () => ({
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  region: process.env.S3_REGION ?? 'us-east-1',
  bucket: process.env.S3_BUCKET ?? 'qalam-media',
  accessKey: process.env.S3_ACCESS_KEY ?? 'minioadmin',
  secretKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
  /** Public CDN origin (P7.1). Empty = clients build URLs from `endpoint`. */
  cdnUrl: process.env.CDN_URL ?? '',
  /** Presigned-URL lifetime (seconds) for the signed-URL seam. */
  signedUrlTtlSeconds: Number(process.env.S3_SIGNED_URL_TTL_SECONDS ?? 900),
}));
