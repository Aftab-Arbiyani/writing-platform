import { PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { storageConfig } from '../config/storage.config';

/**
 * S3-compatible object storage (MinIO in dev, S3/R2 in prod) — the storage
 * abstraction media goes through (docs 13 §7; ADR §3: API never stores bytes
 * locally). `forcePathStyle` is required for MinIO. Object keys are always
 * server-generated (docs 13 §6, path-traversal defense).
 */
@Injectable()
export class MediaStorageService {
  private readonly client: S3Client;

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

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }
}
