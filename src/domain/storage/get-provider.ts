import { CloudflareR2StorageProvider } from "@/domain/storage/r2-provider";
import { FakeObjectStorageProvider } from "@/domain/storage/fake-provider";
import type { ObjectStorageProvider } from "@/domain/storage/types";
import { getServerEnv } from "@/lib/env";

let cached: ObjectStorageProvider | null = null;

export function isObjectStorageEnabled(): boolean {
  try {
    const env = getServerEnv();
    return (
      env.FEATURE_OBJECT_STORAGE === "true" &&
      env.FEATURE_R2_UPLOADS === "true"
    );
  } catch {
    return (
      process.env.FEATURE_OBJECT_STORAGE === "true" &&
      process.env.FEATURE_R2_UPLOADS === "true"
    );
  }
}

export function isCourseImageCacheEnabled(): boolean {
  try {
    return getServerEnv().FEATURE_COURSE_IMAGE_CACHE === "true";
  } catch {
    return process.env.FEATURE_COURSE_IMAGE_CACHE === "true";
  }
}

export function isMediaOrphanCleanupEnabled(): boolean {
  try {
    return getServerEnv().FEATURE_MEDIA_ORPHAN_CLEANUP === "true";
  } catch {
    return process.env.FEATURE_MEDIA_ORPHAN_CLEANUP === "true";
  }
}

/**
 * Returns the configured provider. When flags/credentials are incomplete,
 * returns a Fake provider so unit tests and local Admin can still exercise flows
 * without writing production secrets into the browser.
 */
export function getObjectStorageProvider(): ObjectStorageProvider {
  if (cached) return cached;

  const env = getServerEnv();
  const providerName = (env.OBJECT_STORAGE_PROVIDER || "r2").toLowerCase();

  if (providerName === "fake") {
    cached = new FakeObjectStorageProvider();
    return cached;
  }

  if (
    providerName === "r2" &&
    env.R2_ACCOUNT_ID &&
    env.R2_BUCKET &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_PUBLIC_BASE_URL
  ) {
    cached = new CloudflareR2StorageProvider({
      accountId: env.R2_ACCOUNT_ID,
      bucket: env.R2_BUCKET,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      publicBaseUrl: env.R2_PUBLIC_BASE_URL,
    });
    return cached;
  }

  cached = new FakeObjectStorageProvider();
  return cached;
}

export function resetObjectStorageProviderCache(): void {
  cached = null;
}
