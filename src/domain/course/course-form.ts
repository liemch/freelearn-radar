import { z } from "zod";

import { isValidHttpUrl } from "@/lib/url";

const httpUrl = z
  .string()
  .url()
  .refine((value) => isValidHttpUrl(value), {
    message: "URL must use http or https",
  });

const optionalHttpUrl = z
  .string()
  .default("")
  .refine((value) => value === "" || isValidHttpUrl(value), {
    message: "URL must use http or https",
  });

export const courseFormSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z
    .string()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case"),
  shortDescription: z.string().max(300).optional().or(z.literal("")),
  description: z.string().max(5000).optional().or(z.literal("")),
  providerId: z.string().uuid(),
  categoryIds: z.array(z.string().uuid()).default([]),
  canonicalUrl: httpUrl,
  outboundUrl: optionalHttpUrl,
  affiliateUrl: optionalHttpUrl,
  instructor: z.string().max(200).optional().or(z.literal("")),
  language: z.string().max(50).optional().or(z.literal("")),
  level: z.enum([
    "BEGINNER",
    "INTERMEDIATE",
    "ADVANCED",
    "ALL_LEVELS",
    "UNKNOWN",
  ]),
  durationMinutes: z.coerce.number().int().positive().optional().nullable(),
  priceType: z.enum([
    "FREE_FULL",
    "FREE_AUDIT",
    "FREE_WITH_COUPON",
    "TEMPORARILY_FREE",
    "FREE_TRIAL",
    "PAID",
    "UNKNOWN",
  ]),
  certificateType: z.enum([
    "FREE_CERTIFICATE",
    "PAID_CERTIFICATE",
    "NO_CERTIFICATE",
    "UNKNOWN",
  ]),
  qualityScore: z.coerce.number().int().min(0).max(100).optional().nullable(),
  editorScore: z.coerce.number().int().min(0).max(100).optional().nullable(),
  status: z
    .enum(["DRAFT", "PUBLISHED", "EXPIRED", "UNAVAILABLE", "ARCHIVED"])
    .default("DRAFT"),
});

export type CourseFormValues = z.infer<typeof courseFormSchema>;

export function emptyToNull(value: string | undefined | null): string | null {
  if (!value || value.trim() === "") {
    return null;
  }

  return value;
}
