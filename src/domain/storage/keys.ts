import { createHash, randomUUID } from "node:crypto";

import type { ManagedAssetType } from "@/db/schema/managed-assets";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

export function extensionForMime(mime: string): string {
  return EXT_BY_MIME[mime.split(";")[0]!.trim()] ?? "bin";
}

export function sha256Hex(bytes: Buffer | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Object keys are never derived from user filenames or raw URLs.
 */
export function buildStorageKey(input: {
  assetType: ManagedAssetType;
  mimeType: string;
  entityId?: string | null;
  contentHash?: string | null;
}): string {
  const id = randomUUID();
  const ext = extensionForMime(input.mimeType);
  const entity = input.entityId?.replace(/[^a-zA-Z0-9_-]/g, "") || "x";

  switch (input.assetType) {
    case "BRANDING":
      return `branding/${entity}/${id}.${ext}`;
    case "COURSE_OVERRIDE":
      return `courses/${entity}/override/${id}.${ext}`;
    case "COURSE_CACHE": {
      const hash = (input.contentHash ?? id).slice(0, 32);
      return `courses/${entity}/cache/${hash}.${ext}`;
    }
    case "AFFILIATE_PRODUCT":
      return `affiliate/${entity}/${id}.${ext}`;
    case "FALLBACK":
      return `fallback/${id}.${ext}`;
    default:
      return `other/${id}.${ext}`;
  }
}

export function assertSafeStorageKey(key: string): void {
  if (
    !key ||
    key.includes("..") ||
    key.startsWith("/") ||
    key.includes("\\") ||
    key.includes("\0")
  ) {
    throw new Error("Object storage key không hợp lệ.");
  }
}
