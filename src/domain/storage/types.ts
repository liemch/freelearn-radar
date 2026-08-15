export type PutObjectInput = {
  key: string;
  bytes: Buffer | Uint8Array;
  contentType: string;
  cacheControl?: string;
};

export type StoredObject = {
  key: string;
  etag?: string | null;
  sizeBytes: number;
};

export type CreateUploadUrlInput = {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
};

export type SignedUpload = {
  url: string;
  headers?: Record<string, string>;
  expiresAt: Date;
};

/**
 * Small S3-compatible storage boundary.
 * Business code must not call Cloudflare R2 APIs directly.
 */
export interface ObjectStorageProvider {
  readonly name: string;

  put(input: PutObjectInput): Promise<StoredObject>;

  delete(key: string): Promise<void>;

  exists(key: string): Promise<boolean>;

  getPublicUrl(key: string): string;

  createUploadUrl?(
    input: CreateUploadUrlInput,
  ): Promise<SignedUpload>;
}
