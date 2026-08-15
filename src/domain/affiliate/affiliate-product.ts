import { z } from "zod";

const MERCHANT_ROOTS = {
  SHOPEE: ["shopee.vn", "shopee.com"],
  LAZADA: ["lazada.vn", "lazada.com"],
} as const;

const REDIRECT_PARAMS = new Set([
  "url",
  "target",
  "destination",
  "redirect",
  "redirect_url",
  "redirect_uri",
  "continue",
  "next",
]);

export type AffiliateMerchant = keyof typeof MERCHANT_ROOTS;

function belongsToRoot(hostname: string, root: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === root || host.endsWith(`.${root}`);
}

export function validateAffiliateProductUrl(
  value: string,
  merchant?: AffiliateMerchant,
): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("URL sản phẩm không hợp lệ");
  }

  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("URL sản phẩm phải dùng HTTPS và không chứa thông tin đăng nhập");
  }

  const allowedRoots = merchant
    ? MERCHANT_ROOTS[merchant]
    : [...MERCHANT_ROOTS.SHOPEE, ...MERCHANT_ROOTS.LAZADA];
  if (!allowedRoots.some((root) => belongsToRoot(url.hostname, root))) {
    throw new Error("Tên miền sản phẩm không thuộc Shopee hoặc Lazada");
  }

  for (const [key, rawValue] of url.searchParams) {
    if (!REDIRECT_PARAMS.has(key.toLowerCase())) continue;
    let nested: URL;
    try {
      nested = new URL(rawValue);
    } catch {
      continue;
    }
    if (
      nested.protocol !== "https:" ||
      !allowedRoots.some((root) => belongsToRoot(nested.hostname, root))
    ) {
      throw new Error("URL sản phẩm chứa chuyển hướng ngoài không an toàn");
    }
  }

  return url.toString();
}

const nullableText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => value || null);

const nullableDate = z
  .union([z.string(), z.date()])
  .optional()
  .nullable()
  .transform((value, context) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      context.addIssue({ code: "custom", message: "Ngày giờ không hợp lệ" });
      return z.NEVER;
    }
    return date;
  });

export const affiliateProductInputSchema = z
  .object({
    merchant: z.enum(["SHOPEE", "LAZADA"]),
    title: z.string().trim().min(2).max(300),
    destinationUrl: z.string().trim(),
    merchantProductId: nullableText,
    imageUrl: nullableText,
    shortDescription: nullableText,
    productCategory: z.enum([
      "BOOK",
      "LAPTOP_TABLET",
      "MONITOR",
      "KEYBOARD_MOUSE",
      "HEADSET_WEBCAM_MIC",
      "LAPTOP_STAND",
      "DESK_LIGHT",
      "STUDY_ACCESSORY",
      "LAB_NETWORKING_DEVICE",
      "OTHER_LEARNING_RELATED",
    ]),
    displayPrice: nullableText,
    originalPrice: nullableText,
    currency: nullableText,
    discountLabel: nullableText,
    shopName: nullableText,
    status: z.enum(["ACTIVE", "INACTIVE"]).default("INACTIVE"),
    startsAt: nullableDate,
    endsAt: nullableDate,
    affiliateProviderId: z.uuid().optional().nullable(),
  })
  .superRefine((value, context) => {
    try {
      validateAffiliateProductUrl(value.destinationUrl, value.merchant);
    } catch (error) {
      context.addIssue({
        code: "custom",
        path: ["destinationUrl"],
        message: error instanceof Error ? error.message : "URL không hợp lệ",
      });
    }
    if (value.startsAt && value.endsAt && value.startsAt >= value.endsAt) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Thời điểm kết thúc phải sau thời điểm bắt đầu",
      });
    }
  })
  .transform((value) => ({
    ...value,
    destinationUrl: validateAffiliateProductUrl(
      value.destinationUrl,
      value.merchant,
    ),
  }));

export const affiliateProductContextInputSchema = z.object({
  placementKey: z.string().trim().min(1).max(100),
  courseId: z.uuid().optional().nullable(),
  topicSlug: nullableText,
  categorySlug: nullableText,
  priority: z.number().int().min(0).max(10_000).default(100),
  enabled: z.boolean().default(true),
});

export function isAffiliateProductActive(
  product: { status: string; startsAt: Date | null; endsAt: Date | null },
  now = new Date(),
): boolean {
  return (
    product.status === "ACTIVE" &&
    (!product.startsAt || product.startsAt <= now) &&
    (!product.endsAt || product.endsAt >= now)
  );
}
