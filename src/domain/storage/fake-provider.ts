import type {
  ObjectStorageProvider,
  PutObjectInput,
  StoredObject,
} from "@/domain/storage/types";
import { assertSafeStorageKey } from "@/domain/storage/keys";

/**
 * In-memory provider for tests and local flag-off dry paths.
 */
export class FakeObjectStorageProvider implements ObjectStorageProvider {
  readonly name = "fake";
  private readonly objects = new Map<
    string,
    { bytes: Buffer; contentType: string }
  >();

  constructor(private readonly publicBaseUrl = "https://fake.storage.local") {}

  async put(input: PutObjectInput): Promise<StoredObject> {
    assertSafeStorageKey(input.key);
    const bytes = Buffer.isBuffer(input.bytes)
      ? input.bytes
      : Buffer.from(input.bytes);
    this.objects.set(input.key, {
      bytes,
      contentType: input.contentType,
    });
    return { key: input.key, sizeBytes: bytes.byteLength, etag: null };
  }

  async delete(key: string): Promise<void> {
    assertSafeStorageKey(key);
    this.objects.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    assertSafeStorageKey(key);
    return this.objects.has(key);
  }

  getPublicUrl(key: string): string {
    assertSafeStorageKey(key);
    return `${this.publicBaseUrl.replace(/\/$/, "")}/${key}`;
  }

  /** Test helper */
  getBytes(key: string): Buffer | null {
    return this.objects.get(key)?.bytes ?? null;
  }

  size(): number {
    return this.objects.size;
  }
}
