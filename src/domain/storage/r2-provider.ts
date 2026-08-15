import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { assertSafeStorageKey } from "@/domain/storage/keys";
import type {
  ObjectStorageProvider,
  PutObjectInput,
  StoredObject,
} from "@/domain/storage/types";

export type CloudflareR2Config = {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
};

/**
 * S3-compatible Cloudflare R2 adapter.
 * Do not instantiate from UI/route code — use getObjectStorageProvider().
 */
export class CloudflareR2StorageProvider implements ObjectStorageProvider {
  readonly name = "r2";
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(config: CloudflareR2Config) {
    this.bucket = config.bucket;
    this.publicBaseUrl = config.publicBaseUrl.replace(/\/$/, "");
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    assertSafeStorageKey(input.key);
    const body = Buffer.isBuffer(input.bytes)
      ? input.bytes
      : Buffer.from(input.bytes);

    const result = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: body,
        ContentType: input.contentType,
        CacheControl:
          input.cacheControl ?? "public, max-age=31536000, immutable",
      }),
    );

    return {
      key: input.key,
      sizeBytes: body.byteLength,
      etag: result.ETag ?? null,
    };
  }

  async delete(key: string): Promise<void> {
    assertSafeStorageKey(key);
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async exists(key: string): Promise<boolean> {
    assertSafeStorageKey(key);
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  getPublicUrl(key: string): string {
    assertSafeStorageKey(key);
    return `${this.publicBaseUrl}/${key}`;
  }
}
