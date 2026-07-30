import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketLifecycleConfigurationCommand,
  PutBucketVersioningCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { storageConfig } from '../config/storage.config';

/** Result of verifying an object landed intact (upload verification, P7.1). */
export interface ObjectVerification {
  readonly exists: boolean;
  readonly size?: number;
  readonly etag?: string;
  readonly contentType?: string;
}

/**
 * S3-compatible object storage (MinIO in dev, S3/R2 in prod) — the storage
 * abstraction media goes through (docs 13 §7; ADR §3: API never stores bytes
 * locally). `forcePathStyle` is required for MinIO. Object keys are always
 * server-generated (docs 13 §6, path-traversal defense).
 */
@Injectable()
export class MediaStorageService {
  private readonly client: S3Client;
  private readonly logger = new Logger(MediaStorageService.name);

  constructor(
    @Inject(storageConfig.KEY) private readonly config: ConfigType<typeof storageConfig>,
  ) {
    this.client = new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: this.config.accessKey, secretAccessKey: this.config.secretKey },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  /** Downloads an object's bytes — used by the media worker to reprocess an upload. */
  async get(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    if (response.Body === undefined) {
      throw new Error(`object "${key}" has no body`);
    }
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  /**
   * Readiness probe — `HEAD` the media bucket (docs 14 §3). Throws if the bucket
   * is unreachable/missing; the caller treats storage as "degraded, not dead"
   * (reads still work), so this never fails liveness.
   */
  async checkHealth(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
  }

  /**
   * Public URL for an object (P7.1 CDN integration). Prefers the configured CDN
   * origin, falling back to the direct S3/MinIO path. Centralizes URL
   * construction that clients previously did ad-hoc from a raw object key.
   */
  publicUrl(key: string): string {
    const base = this.config.cdnUrl.length > 0 ? this.config.cdnUrl : this.config.endpoint;
    const origin = base.replace(/\/+$/, '');
    return this.config.cdnUrl.length > 0
      ? `${origin}/${key}`
      : `${origin}/${this.config.bucket}/${key}`;
  }

  /**
   * Upload verification (P7.1): confirm an object actually landed and read back
   * its size/etag/content-type. Returns `{ exists: false }` on 404 rather than
   * throwing, so callers can distinguish "not there" from a transport error.
   */
  async verifyObject(key: string): Promise<ObjectVerification> {
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      return {
        exists: true,
        size: head.ContentLength,
        etag: head.ETag,
        contentType: head.ContentType,
      };
    } catch (error) {
      const name = (error as { name?: string }).name ?? '';
      if (name === 'NotFound' || name === 'NoSuchKey') {
        return { exists: false };
      }
      throw error;
    }
  }

  /**
   * Boot/ops-time bucket validation (P7.1). Confirms the bucket exists; in dev
   * (`autoCreate`) creates it when missing so a fresh MinIO works without a
   * manual step. In production `autoCreate` stays false — the bucket is
   * provisioned by infra and a missing bucket is a hard error surfaced here.
   */
  async ensureBucket(autoCreate = false): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
      return true;
    } catch (error) {
      if (!autoCreate) throw error;
      this.logger.warn(`bucket "${this.config.bucket}" missing — creating (dev autoCreate)`);
      await this.client.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
      return false;
    }
  }

  /**
   * Enable object versioning on the bucket (P7.1 "Object Versioning Ready" — a
   * pillar of object-storage recovery). Idempotent; supported by S3/R2 and
   * MinIO. No-op friendly to call from a provisioning script.
   */
  async enableVersioning(): Promise<void> {
    await this.client.send(
      new PutBucketVersioningCommand({
        Bucket: this.config.bucket,
        VersioningConfiguration: { Status: 'Enabled' },
      }),
    );
  }

  /**
   * Apply lifecycle rules (P7.1): expire transient `tmp/`+`quarantine/` prefixes
   * and abort dangling multipart uploads, so storage cost/junk is bounded
   * without a cron. Idempotent — the named rules are replaced wholesale.
   */
  async applyLifecyclePolicy(): Promise<void> {
    await this.client.send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: this.config.bucket,
        LifecycleConfiguration: {
          Rules: [
            {
              ID: 'qalam-expire-tmp',
              Status: 'Enabled',
              Filter: { Prefix: 'tmp/' },
              Expiration: { Days: 1 },
            },
            {
              ID: 'qalam-expire-quarantine',
              Status: 'Enabled',
              Filter: { Prefix: 'quarantine/' },
              Expiration: { Days: 7 },
            },
            {
              ID: 'qalam-abort-incomplete-mpu',
              Status: 'Enabled',
              Filter: { Prefix: '' },
              AbortIncompleteMultipartUpload: { DaysAfterInitiation: 3 },
            },
          ],
        },
      }),
    );
  }
}
