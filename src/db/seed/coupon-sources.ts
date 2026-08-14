import type { Db } from "@/db";
import { upsertCouponSource } from "@/db/repositories/coupon-repository";

/**
 * Seed disabled coupon sources. Operators must enable after policy review.
 * Do not hard-depend on any live aggregator.
 */
export async function seedCouponSources(db: Db) {
  await upsertCouponSource(db, {
    name: "Manual operator paste",
    sourceKey: "manual-operator",
    sourceType: "MANUAL",
    baseUrl: "https://www.udemy.com/",
    enabled: false,
    priority: 10,
    discoveryOnly: true,
    healthStatus: "DISABLED",
    configJson: {
      note: "Operator enables after policy review. Paste/manual ingest only.",
    },
  });

  await upsertCouponSource(db, {
    name: "Real.Discount (placeholder)",
    sourceKey: "real-discount-placeholder",
    sourceType: "HTML",
    baseUrl: "https://www.real.discount/",
    enabled: false,
    priority: 200,
    discoveryOnly: true,
    healthStatus: "DISABLED",
    configJson: {
      note: "Disabled placeholder — enable only after source policy review. discovery_only=true.",
      discovery_only: true,
    },
  });
}
